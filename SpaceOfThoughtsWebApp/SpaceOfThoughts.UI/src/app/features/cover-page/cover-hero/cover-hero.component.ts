import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { FramedImageComponent } from '../../../core/media/framed-image.component';
import { FramedBackgroundLayerComponent } from '../../../core/media/framed-background-layer.component';
import { User } from '../../auth/models/user.model';
import { BlogPost } from '../../blog-post/models/blog-post.model';
import { UpdateCoverPage } from '../models/update-cover-page.model';

// One renderer is shared by the public cover and its editor preview. Keeping the
// complete scene here prevents the preview's typography, responsive layout, and
// image crop from drifting away from what readers actually see.
@Component({
  selector: 'app-cover-hero',
  imports: [
    DatePipe,
    RouterModule,
    FramedImageComponent,
    FramedBackgroundLayerComponent,
  ],
  templateUrl: './cover-hero.component.html',
  styleUrl: './cover-hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverHeroComponent {
  readonly page = input<UpdateCoverPage | undefined>(undefined);
  readonly currentUser = input<User | undefined>(undefined);
  readonly backgroundImageUrl = input<string | null | undefined>(undefined);
  readonly backgroundImagePosition = input<string | null | undefined>(
    undefined,
  );
  readonly loading = input(false);
  readonly notPublished = input(false);
  readonly editorPreview = input(false);
  readonly blogPreviews = input<readonly BlogPost[]>([]);
  readonly blogPreviewPosition = input(0);
  readonly blogPreviewTotal = input(0);

  protected readonly backgroundOverlayOpacity = computed(
    () => (this.page()?.backgroundOverlayStrength ?? 100) / 100,
  );
}
