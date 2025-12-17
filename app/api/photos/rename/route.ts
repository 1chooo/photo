import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const db = getAdminDb();
    const body = await request.json();
    const { oldSlug, newSlug } = body;

    if (!oldSlug || !newSlug) {
      return NextResponse.json(
        { error: 'Both oldSlug and newSlug are required' },
        { status: 400 }
      );
    }

    if (oldSlug === newSlug) {
      return NextResponse.json(
        { error: 'New slug must be different from old slug' },
        { status: 400 }
      );
    }

    // Check if old slug exists
    const oldDocRef = db.collection('photo-gallery').doc(oldSlug);
    const oldDoc = await oldDocRef.get();

    if (!oldDoc.exists) {
      return NextResponse.json(
        { error: 'Old slug not found' },
        { status: 404 }
      );
    }

    // Check if new slug already exists
    const newDocRef = db.collection('photo-gallery').doc(newSlug);
    const newDoc = await newDocRef.get();

    if (newDoc.exists) {
      return NextResponse.json(
        { error: 'New slug already exists' },
        { status: 409 }
      );
    }

    // Get old data
    const oldData = oldDoc.data();

    // Create new document with new slug
    await newDocRef.set({
      ...oldData,
      slug: newSlug,
      updatedAt: new Date().toISOString(),
    });

    // Delete old document
    await oldDocRef.delete();

    return NextResponse.json({ 
      success: true, 
      message: `Successfully renamed ${oldSlug} to ${newSlug}` 
    }, { status: 200 });
  } catch (error) {
    console.error('Error renaming slug:', error);
    return NextResponse.json(
      { error: 'Failed to rename slug' },
      { status: 500 }
    );
  }
}
