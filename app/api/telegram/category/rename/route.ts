import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase/admin";

// 驗證 Firebase ID Token
async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Auth verification failed:", error);
    return null;
  }
}

// POST: 重新命名 slug（分類）
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { oldSlug, newSlug } = body;

    if (!oldSlug || !newSlug) {
      return NextResponse.json(
        { error: "Both oldSlug and newSlug are required" },
        { status: 400 }
      );
    }

    if (oldSlug === newSlug) {
      return NextResponse.json(
        { error: "New slug must be different from old slug" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 檢查舊 slug 是否存在
    const oldDocRef = db.collection('telegram-categories').doc(oldSlug);
    const oldDoc = await oldDocRef.get();

    if (!oldDoc.exists) {
      return NextResponse.json(
        { error: "Old slug not found" },
        { status: 404 }
      );
    }

    // 檢查新 slug 是否已存在
    const newDocRef = db.collection('telegram-categories').doc(newSlug);
    const newDoc = await newDocRef.get();

    if (newDoc.exists) {
      return NextResponse.json(
        { error: "New slug already exists" },
        { status: 409 }
      );
    }

    // 取得舊資料
    const oldData = oldDoc.data();

    // 建立新 document 使用新 slug
    await newDocRef.set({
      ...oldData,
      slug: newSlug,
      updatedAt: new Date().toISOString(),
    });

    // 刪除舊 document
    await oldDocRef.delete();

    return NextResponse.json(
      { 
        success: true, 
        message: `Successfully renamed ${oldSlug} to ${newSlug}` 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error renaming slug:", error);
    return NextResponse.json(
      { error: "Failed to rename slug" },
      { status: 500 }
    );
  }
}
