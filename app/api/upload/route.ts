import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";
import { UserSettings, TelegramChat } from "@/types/settings";

// 驗證 Firebase ID Token 並返回用戶 ID
async function verifyAuth(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}

// 獲取用戶的 Telegram 設定
async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const db = getAdminDb();
    const settingsDoc = await db.collection('userSettings').doc(userId).get();
    
    if (!settingsDoc.exists) {
      return null;
    }
    
    return settingsDoc.data() as UserSettings;
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    return null;
  }
}

// 獲取用戶的預設 Telegram Chat（或指定的 Chat）
function getDefaultChat(settings: UserSettings | null, chatId?: string): TelegramChat | null {
  if (!settings) return null;
  
  // 支援新的多 chat 格式
  if (settings.telegramChats && settings.telegramChats.length > 0) {
    if (chatId) {
      return settings.telegramChats.find(chat => chat.id === chatId) || null;
    }
    // 返回預設 chat 或第一個 chat
    return settings.telegramChats.find(chat => chat.isDefault) || settings.telegramChats[0];
  }
  
  // 向後相容：支援舊的單一 chat 格式
  if (settings.telegramBotToken && settings.telegramChatId) {
    return {
      id: 'legacy',
      name: 'Default Chat',
      botToken: settings.telegramBotToken,
      chatId: settings.telegramChatId,
      isDefault: true
    };
  }
  
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 驗證用戶身份
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    // 獲取用戶的 Telegram 設定
    const userSettings = await getUserSettings(userId);
    
    // 從 query string 獲取指定的 chat ID（可選）
    const url = new URL(req.url);
    const chatId = url.searchParams.get('chatId') || undefined;
    
    const chat = getDefaultChat(userSettings, chatId);
    
    if (!chat) {
      return NextResponse.json(
        { 
          error: "請先在 Settings 頁面設定您的 Telegram Chat",
          redirectTo: "/dashboard/settings"
        },
        { status: 400 }
      );
    }

    const BOT_TOKEN = chat.botToken;
    const CHAT_ID = chat.chatId;

    // 1. Parse the incoming form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (only images allowed)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: `File type ${file.type} is not supported. Only image files are allowed.` },
        { status: 400 }
      );
    }

    // Validate file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { error: `10MB The file size (${sizeMB}MB) exceeds the 10MB limit.
        ` },
        { status: 400 }
      );
    }

    // 2. prepare FormData for Telegram API
    const telegramFormData = new FormData();
    telegramFormData.append("chat_id", CHAT_ID);
    telegramFormData.append("photo", file);

    // 3. Upload image to Telegram (sendPhoto method)
    const uploadRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: telegramFormData,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadData.ok) {
      console.error("Telegram Error:", uploadData);
      
      // Supply more specific error messages based on Telegram's response
      const telegramError = uploadData.description || "Failed to upload to Telegram";
      return NextResponse.json(
        { 
          error: `Telegram API 錯誤: ${telegramError}`,
          details: uploadData
        },
        { status: 500 }
      );
    }

    // 4. Get the file_id from Telegram response
    const photos = uploadData.result.photo;
    const fileId = photos[photos.length - 1].file_id;

    // 5. Use getFile to get the file path
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
    );
    const getFileData = await getFileRes.json();

    if (!getFileData.ok) {
      console.error("Telegram getFile Error:", getFileData);
      const telegramError = getFileData.description || "Failed to get file URL";
      return NextResponse.json(
        { 
          error: `Telegram getFile 錯誤: ${telegramError}`,
          details: getFileData
        },
        { status: 500 }
      );
    }

    const filePath = getFileData.result.file_path;

    // 6. Construct the file download URL
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // 7. Store image metadata in Firestore
    const db = getAdminDb();
    const imageData = {
      id: `tg-${Date.now()}`,
      url: fileUrl,
      file_id: fileId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
      telegram_file_path: filePath,
    };

    try {
      await db.collection('tg-as-image-storage').doc(imageData.id).set(imageData);
    } catch (dbError) {
      console.error("Firestore Error:", dbError);
      return NextResponse.json(
        { 
          error: "Image uploaded to Telegram but failed to save in database",
          file_url: fileUrl,
          details: dbError instanceof Error ? dbError.message : "Unknown database error"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...imageData,
    });
  } catch (error) {
    console.error("Server Error:", error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = "Internal Server Error";
    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        errorMessage = "Failed to connect to Telegram API, please try again later";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Request to Telegram API timed out, please try again";
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
