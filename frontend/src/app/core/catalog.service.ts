import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Configuration, Paged, ProductDetail, ProductSummary } from './catalog.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(ApiService);

  listProducts(params: { category?: string; generation?: string; page?: number; pageSize?: number } = {}): Observable<Paged<ProductSummary>> {
    return this.api.get('/products', params);
  }

  getProduct(idOrSlug: string, country?: string): Observable<ProductDetail> {
    return this.api.get(`/products/${encodeURIComponent(idOrSlug)}`, { country });
  }

  getConfiguration(id: string): Observable<Configuration> {
    return this.api.get(`/configurations/${encodeURIComponent(id)}`);
  }
}
