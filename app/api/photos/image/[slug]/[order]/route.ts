import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; order: string }> }
) {
  try {
    const { slug, order } = await context.params;
    const orderNum = parseInt(order, 10);

    if (isNaN(orderNum) || orderNum < 0) {
      return NextResponse.json(
        { error: 'Invalid order number' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const docRef = db.collection('photo-gallery').doc(slug);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Gallery not found' },
        { status: 404 }
      );
    }

    const photos = doc.data()?.photos || [];
    const photo = photos.find((p: any) => p.order === orderNum);

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Fetch the actual image from the real URL
    const imageResponse = await fetch(photo.url);
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 500 }
      );
    }

    // Get the image data and content type
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
