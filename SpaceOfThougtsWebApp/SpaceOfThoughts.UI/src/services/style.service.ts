import { Injectable } from '@angular/core';
import { Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
  providedIn: 'root', // This service will be provided at the root level
})
export class StyleService {
  private renderer: Renderer2; // Renderer2 instance for manipulating the DOM

  constructor(private rendererFactory: RendererFactory2) {
    // Create the renderer using the RendererFactory2
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  // Method to set a style on the document body
  setBodyStyle(style: string, value: string) {
    this.renderer.setStyle(document.body, style, value);
  }
}
