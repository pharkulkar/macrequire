import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RecommendationProfile } from './profile.models';
import { CompareDto, RecommendationDto, SpecCompareDto } from './recommendation.models';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly api = inject(ApiService);

  create(profile: RecommendationProfile): Observable<RecommendationDto> {
    return this.api.post('/recommendations', profile);
  }

  get(id: string): Observable<RecommendationDto> {
    return this.api.get(`/recommendations/${encodeURIComponent(id)}`);
  }

  /** Scores the chosen configurations against a stored recommendation. */
  compareScored(recommendationId: string, configurationIds: string[]): Observable<CompareDto> {
    return this.api.post('/recommendations/compare', { recommendationId, configurationIds });
  }

  /** Specifications only, when there is no recommendation to score against. */
  compareSpecs(configurationIds: string[], country?: string): Observable<SpecCompareDto> {
    return this.api.get('/configurations/compare', { ids: configurationIds.join(','), country });
  }
}
