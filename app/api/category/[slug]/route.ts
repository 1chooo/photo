import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

// GET: 公開獲取特定分類的圖片（用於公開頁面）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: "Slug is required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const docRef = db.collection('telegram-categories').doc(slug);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const data = doc.data();
    const images = data?.images || [];

    return NextResponse.json(
      {
        slug,
        images,
        name: data?.name || slug,
        updatedAt: data?.updatedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`Error fetching category:`, error);
    return NextResponse.json(
      { error: "Failed to fetch category images" },
      { status: 500 }
    );
  }
}
