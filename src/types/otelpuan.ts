export interface OtelpuanReview {
  platform: "otelpuan";
  externalReviewId: string;
  hotelName: string | null;
  reviewerName: string | null;
  rating: number | null;
  reviewTitle: string | null;
  reviewText: string;
  reviewDate: string | null;
  stayDate: string | null;
  roomScore: number | null;
  serviceScore: number | null;
  foodScore: number | null;
  cleanlinessScore: number | null;
  locationScore: number | null;
  verified: boolean | null;
  sourceUrl: string;
  metadata: {
    originalRating: number | null;
    originalDateText: string | null;
    originalStayDateText: string | null;
    reviewType: string | null;
    recommendationStatus: string | null;
  };
}
