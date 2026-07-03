export interface UnifiedNormalizedReview {
  platform: string;
  guestName: string;
  rating: number;
  reviewTitle: string;
  reviewText: string;
  reviewDate: string | null;
  travelDate: string | null;
  travelerType: string | null;
  numberOfNights: number | null;
  sourceUrl: string;
  ownerResponseText: string | null;
  ownerResponseDate: string | null;
  metadata: any;
  externalId: string;
}

export function normalizeBookingReview(item: any, bookingUrl: string, idx: number = 0): UnifiedNormalizedReview {
  const rawRating = Number(item.rating || 0);
  const rating = rawRating > 5 ? Math.max(1, Math.min(5, Math.round(rawRating / 2))) : Math.max(1, Math.min(5, Math.round(rawRating)));

  const reviewTitle = item.reviewTitle || "";
  const reviewText = [
    item.reviewTitle,
    item.likedText,
    item.dislikedText
  ]
    .filter(Boolean)
    .join("\n\n") || 'No comment review.';

  const reviewDate = item.reviewDate || null;
  const travelerType = item.travelerType || null;
  const numberOfNights = item.numberOfNights ? Number(item.numberOfNights) : null;
  const likedText = item.likedText || null;
  const dislikedText = item.dislikedText || null;

  const metadata = {
    reviewTitle,
    likedText,
    dislikedText,
    travelerType,
    numberOfNights
  };

  const externalId = item.id || item.reviewId || `booking-mock-${item.userName || 'guest'}-${rating}-${reviewDate || 'nodate'}-${idx}`;

  return {
    platform: 'Booking',
    guestName: item.userName || "Booking Guest",
    rating,
    reviewTitle,
    reviewText,
    reviewDate,
    travelDate: null,
    travelerType,
    numberOfNights,
    sourceUrl: bookingUrl,
    ownerResponseText: null,
    ownerResponseDate: null,
    metadata,
    externalId
  };
}

export function normalizeTripAdvisorReview(item: any, tripadvisorUrl: string, idx: number = 0): UnifiedNormalizedReview {
  const guestName = 
    item.user?.name || 
    item.user?.username || 
    item.reviewerName || 
    item.userName || 
    item.username || 
    "TripAdvisor Guest";

  let rawRating = Number(item.rating || item.reviewRating || item.ratingRange || item.ratingScore || item.stars || 5);
  if (rawRating > 5) {
    rawRating = rawRating / 10;
  }
  const rating = Math.max(1, Math.min(5, Math.round(rawRating)));

  const reviewTitle = item.title || "";
  const reviewText = item.text || item.reviewText || item.textReview || item.comment || item.commentReview || item.description || 'No comment review.';
  const reviewDate = item.publishedDate || null;
  const travelDate = item.travelDate || null;

  const ownerResponseText = item.ownerResponse?.text || null;
  const ownerResponseDate = item.ownerResponse?.publishedDate || null;

  const metadata = {
    travelDate,
    user: item.user || null,
    ownerResponse: item.ownerResponse || null,
    placeInfo: item.placeInfo || null
  };

  const externalId = item.id || item.reviewId || item.url || `tripadvisor-mock-${guestName}-${rating}-${reviewDate || 'nodate'}-${idx}`;

  return {
    platform: 'Tripadvisor',
    guestName,
    rating,
    reviewTitle,
    reviewText,
    reviewDate,
    travelDate,
    travelerType: null,
    numberOfNights: null,
    sourceUrl: item.url || tripadvisorUrl,
    ownerResponseText,
    ownerResponseDate,
    metadata,
    externalId
  };
}

export function normalizeGoogleReview(item: any, googleUrl: string, idx: number = 0): UnifiedNormalizedReview {
  const guestName = item.name || item.authorName || 'Anonymous Guest';
  const rating = Number(item.starsScore || item.stars || 5);

  const reviewText = item.text || item.textTranslated || 'No comment review.';
  
  const reviewDate = 
    item.publishedAt ||
    item.publishedDate ||
    item.reviewTime ||
    item.relativeTimeDescription ||
    item.date ||
    null;

  const ownerResponseText = item.reply?.text || item.reply?.comment || null;
  const ownerResponseDate = item.reply?.publishedAt || item.reply?.date || null;

  const metadata = {
    publishAt: item.publishAt || null,
    publishedAtDate: item.publishedAtDate || null,
    relativeTimeDate: item.relativeTimeDate || null,
    relativeTime: item.relativeTime || null
  };

  const externalId = item.reviewId || item.id || `google-mock-${guestName}-${rating}-${reviewDate || 'nodate'}-${idx}`;

  return {
    platform: 'Google',
    guestName,
    rating,
    reviewTitle: "",
    reviewText,
    reviewDate,
    travelDate: null,
    travelerType: null,
    numberOfNights: null,
    sourceUrl: googleUrl,
    ownerResponseText,
    ownerResponseDate,
    metadata,
    externalId
  };
}

export function normalizeHotelsComReview(item: any, hotelscomUrl: string, idx: number = 0): UnifiedNormalizedReview {
  const guestName = item.authorName || item.author || item.reviewerName || 'Hotels.com Guest';

  const score = Number(item.reviewRating || item.rating || item.score || item.overallRating || 10);
  const rating = score > 5 ? Math.max(1, Math.min(5, Math.round(score / 2))) : Math.max(1, Math.min(5, Math.round(score)));

  const reviewTitle = item.title || "";
  const reviewText = item.reviewText || item.text || item.description || item.comment || item.content || 'No comment review.';
  const reviewDate = item.reviewDate || item.date || item.publishedDate || null;

  const travelerType = item.travelerType || null;
  const numberOfNights = item.numberOfNights ? Number(item.numberOfNights) : null;

  const metadata = {
    travelerType,
    numberOfNights
  };

  const sourceUrl = item.hotelscomUrl || item.url || item.sourceUrl || hotelscomUrl;
  const externalId = item.id || item.reviewId || `hotelscom-mock-${guestName}-${rating}-${reviewDate || 'nodate'}-${idx}`;

  return {
    platform: 'hotels.com',
    guestName,
    rating,
    reviewTitle,
    reviewText,
    reviewDate,
    travelDate: null,
    travelerType,
    numberOfNights,
    sourceUrl,
    ownerResponseText: null,
    ownerResponseDate: null,
    metadata,
    externalId
  };
}

export function normalizeHolidayCheckReview(item: any, holidaycheckUrl: string, idx: number = 0): UnifiedNormalizedReview {
  const guestName = item.author || item.authorName || item.userName || item.reviewerName || item.name || 'HolidayCheck Guest';

  const score = Number(item.rating || item.score || item.overallRating || item.totalRating || item.stars || 6);
  const rating = (score <= 6 && score > 0) ? Math.max(1, Math.min(5, Math.round((score / 6) * 5))) : Math.max(1, Math.min(5, Math.round(score)));

  const reviewTitle = item.title || item.reviewTitle || item.headline || "";
  const text = item.reviewText || item.text || item.description || item.comment || item.content || '';
  
  let reviewText = text;
  if (reviewTitle && reviewTitle.trim()) {
    reviewText = `${reviewTitle.trim()}\n\n${text.trim()}`;
  }

  if (!reviewText.trim()) {
    reviewText = 'No comment review.';
  }

  const reviewDate = item.date || item.reviewDate || item.publishedDate || null;

  const metadata = {
    headline: item.headline || null,
    ratingDetail: item.ratingDetail || null
  };

  const externalId = item.id || item.reviewId || `holidaycheck-mock-${guestName}-${rating}-${reviewDate || 'nodate'}-${idx}`;

  return {
    platform: 'holidaycheck',
    guestName,
    rating,
    reviewTitle,
    reviewText,
    reviewDate,
    travelDate: null,
    travelerType: null,
    numberOfNights: null,
    sourceUrl: holidaycheckUrl,
    ownerResponseText: null,
    ownerResponseDate: null,
    metadata,
    externalId
  };
}
