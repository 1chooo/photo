import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { UserSettings, TelegramChat } from '@/types/settings';

async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

// 遷移舊資料格式到新格式
function migrateOldSettings(settings: UserSettings): TelegramChat[] {
  if (settings.telegramChats && settings.telegramChats.length > 0) {
    return settings.telegramChats;
  }
  
  // 如果有舊的單一 chat 設定，轉換成新格式
  if (settings.telegramBotToken && settings.telegramChatId) {
    return [{
      id: 'default',
      name: 'Default Chat',
      botToken: settings.telegramBotToken,
      chatId: settings.telegramChatId,
      isDefault: true
    }];
  }
  
  return [];
}

// GET: 讀取用戶設定
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = getAdminDb();
    const settingsDoc = await db.collection('userSettings').doc(userId).get();

    if (!settingsDoc.exists) {
      return NextResponse.json({
        telegramChats: [],
      });
    }

    const settings = settingsDoc.data() as UserSettings;
    const telegramChats = migrateOldSettings(settings);
    
    return NextResponse.json({
      telegramChats,
    });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST: 儲存用戶設定
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { telegramChats } = body;

    // 驗證輸入
    if (!telegramChats || !Array.isArray(telegramChats)) {
      return NextResponse.json(
        { error: 'Invalid telegram chats configuration' },
        { status: 400 }
      );
    }

    // 驗證每個 chat 的資料
    for (const chat of telegramChats) {
      if (!chat.id || !chat.name || !chat.botToken || !chat.chatId) {
        return NextResponse.json(
          { error: 'Each chat must have id, name, botToken, and chatId' },
          { status: 400 }
        );
      }
    }

    // 確保至少有一個 chat 被標記為預設
    const hasDefault = telegramChats.some((chat: TelegramChat) => chat.isDefault);
    if (telegramChats.length > 0 && !hasDefault) {
      telegramChats[0].isDefault = true;
    }

    const db = getAdminDb();
    const settings: UserSettings = {
      telegramChats,
      updatedAt: new Date(),
    };

    await db.collection('userSettings').doc(userId).set(settings, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
