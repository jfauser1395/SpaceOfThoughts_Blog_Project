// Interface for updating the editable cover page content
export interface UpdateCoverPage {
  // Short introductory label displayed above the welcome title
  kicker: string;

  // Main welcome title displayed on the cover page
  welcomeTitle: string;

  // Introductory text displayed below the welcome title
  introduction: string;

  // Optional background image URL for the cover page
  backgroundImageUrl?: string | null;

  // Saved "x% y% zoom%" framing applied to the cover background image
  backgroundImagePosition?: string | null;

  // Strength of the translucent gradient placed over the cover background
  backgroundOverlayStrength: number;
}
