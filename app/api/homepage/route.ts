import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const db = getAdminDb();
    const docRef = db.collection('settings').doc('homepage-photos');
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ selectedPhotos: [] }, { status: 200 });
    }

    return NextResponse.json(doc.data(), { status: 200 });
  } catch (error) {
    console.error('Error fetching homepage photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homepage photos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getAdminDb();
    const body = await request.json();
    const { selectedPhotos } = body;

    if (!Array.isArray(selectedPhotos)) {
      return NextResponse.json(
        { error: 'selectedPhotos must be an array' },
        { status: 400 }
      );
    }

    const docRef = db.collection('settings').doc('homepage-photos');
    await docRef.set({
      selectedPhotos,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error updating homepage photos:', error);
    return NextResponse.json(
      { error: 'Failed to update homepage photos' },
      { status: 500 }
    );
  }
}
