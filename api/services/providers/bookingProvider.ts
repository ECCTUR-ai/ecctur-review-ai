// api/services/providers/bookingProvider.ts
export interface BookingReview {
  review_id: string;
  guest_name: string;
  rating: number;
  headline?: string;
  review_text: string;
  review_date: string;
  language: string;
}

export const bookingProvider = {
  async fetchReviews(propertyId: string): Promise<BookingReview[]> {
    const username = process.env.BOOKING_USERNAME || '';
    const password = process.env.BOOKING_PASSWORD || '';

    // If no credentials, run in mock/test mode gracefully
    if (!username || !password) {
      console.log('[BookingProvider] Running in Mock Mode (missing BOOKING_USERNAME or BOOKING_PASSWORD)');
      return [
        {
          review_id: `booking-mock-${propertyId}-301`,
          guest_name: 'Ayşe Demir',
          rating: 9.2, // Booking.com uses 10-point scale
          headline: 'Konumu harikaydı, odalar çok geniş ve ferahtı.',
          review_text: 'Otel personeli çok cana yakındı. Kahvaltı çeşidi oldukça zengindi. Sadece otopark alanı biraz dardı fakat görevliler yardımcı oldu.',
          review_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          language: 'tr'
        },
        {
          review_id: `booking-mock-${propertyId}-302`,
          guest_name: 'John Doe',
          rating: 7.0,
          headline: 'Decent stay but room was noisy',
          review_text: 'The location is central and close to public transit. However, the walls are very thin and I could hear street noise all night.',
          review_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          language: 'en'
        },
        {
          review_id: `booking-mock-${propertyId}-303`,
          guest_name: 'Marie Laurent',
          rating: 10.0,
          headline: 'Séjour fantastique!',
          review_text: 'Tout était parfait. Le lit était extrêmement confortable, le petit déjeuner délicieux et la vue sur la mer magnifique.',
          review_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          language: 'fr'
        }
      ];
    }

    // Real API call with Basic Auth
    const authString = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Booking.com Partner/Distribution API endpoint format for reviews
    const url = `https://distribution-xml.booking.com/2.0/json/reviews?property_ids=${propertyId}&rows=100`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Booking.com API failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Parse response format according to standard Booking.com response structure
    const results = data.result || [];
    return results.map((r: any) => ({
      review_id: String(r.review_id || r.id),
      guest_name: r.author || r.guest_name || 'Anonymous',
      rating: Number(r.average_score || r.score || r.rating || 10),
      headline: r.headline || '',
      review_text: r.pros || r.cons ? `${r.pros || ''} ${r.cons || ''}`.trim() : (r.comment || r.review_text || ''),
      review_date: r.created || r.date || new Date().toISOString(),
      language: r.language || 'en'
    }));
  }
};
