import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { marked } from 'marked';

type ActiveFormattingState = {
  // Track which formatting controls are active for the current selection
  bold: boolean;
  bulletList: boolean;
  code: boolean;
  italic: boolean;
  link: boolean;
  numberedList: boolean;
  quote: boolean;
  textStyle: string;
};

@Component({
  selector: 'app-markdown-editor',
  templateUrl: './markdown-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './markdown-editor.component.css',
})
export class MarkdownEditorComponent implements AfterViewInit {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  // Accessibility ID used to connect the editor with its visible label
  readonly ariaLabelledBy = input('');
  readonly editorId = input('content');

  // Model provides the content input and matching contentChange output for two-way binding
  readonly content = model('');

  // Raised when the writer asks for a picture; the form opens its library
  readonly imagePickerRequested = output<void>();

  // Id of the modal holding the shared picture library, when the host has one
  readonly pickerModalId = input<string | null>(null);

  // Whether the next inserted picture is bordered, chosen per picture
  readonly borderNextImage = signal(false);

  // Options displayed in the text style dropdown
  readonly textStyleOptions = [
    { label: 'Paragraph', value: 'p' },
    { label: 'Heading 1', value: 'h1' },
    { label: 'Heading 2', value: 'h2' },
    { label: 'Heading 3', value: 'h3' },
    { label: 'Heading 4', value: 'h4' },
  ];

  // Current formatting state used by toolbar active states
  readonly activeFormatting = signal<ActiveFormattingState>({
    bold: false,
    bulletList: false,
    code: false,
    italic: false,
    link: false,
    numberedList: false,
    quote: false,
    textStyle: 'p',
  });
  readonly isTextStyleMenuOpen = signal(false);
  readonly characterCount = signal(0);
  readonly wordCount = signal(0);
  readonly activeTextStyleLabel = computed(
    () =>
      this.textStyleOptions.find(
        (option) => option.value === this.activeFormatting().textStyle,
      )?.label ?? 'Paragraph',
  );

  private readonly visualEditor =
    viewChild<ElementRef<HTMLElement>>('visualEditor');

  // Editor content is stored as HTML after it has been rendered or edited
  private contentValue = '';
  private savedSelection?: Range;
  private viewReady = false;

  // Synchronize parent model writes with the contenteditable DOM
  private readonly contentRenderEffect = effect(() => {
    // Avoid re-rendering the editor when Angular writes the same value back
    const nextContent = this.content() ?? '';

    if (nextContent === this.contentValue) {
      return;
    }

    this.contentValue = nextContent;
    this.renderContentToEditor();
  });

  ngAfterViewInit(): void {
    // Render any initial content once the contenteditable element exists
    this.viewReady = true;
    this.renderContentToEditor();
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    // Keep toolbar button states aligned with the active text selection
    this.updateActiveFormatting();
  }

  @HostListener('document:click', ['$event'])
  // Close editor menus when focus moves outside the component
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    if (!this.hostElement.nativeElement.contains(target)) {
      // Close the text style menu when the user clicks outside the editor
      this.isTextStyleMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  // Support the conventional Escape-key behavior for the text style menu
  onDocumentEscape(): void {
    this.isTextStyleMenuOpen.set(false);
  }

  onEditorInput(): void {
    // Sync typed content back to the parent component
    this.syncContentFromEditor();
    this.saveSelection();
    this.updateActiveFormatting();
  }

  // Preserve content and selection state when the editor loses focus
  onEditorBlur(): void {
    this.syncContentFromEditor();
    this.saveSelection();
    this.updateActiveFormatting();
  }

  // Refresh toolbar state after the pointer changes the text selection
  onEditorMouseup(): void {
    this.saveSelection();
    this.updateActiveFormatting();
  }

  // Refresh toolbar state after keyboard selection or caret movement
  onEditorKeyup(): void {
    this.saveSelection();
    this.updateActiveFormatting();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    // Support familiar keyboard shortcuts for bold and italic
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'b') {
      event.preventDefault();
      this.applyBold();
      return;
    }

    if (key === 'i') {
      event.preventDefault();
      this.applyItalic();
    }
  }

  onToolbarMouseDown(event: MouseEvent): void {
    // Prevent toolbar clicks from stealing the current text selection
    event.preventDefault();
    this.saveSelection();
  }

  // Toggle the block-style menu without changing the saved editor selection
  toggleTextStyleMenu(): void {
    this.isTextStyleMenuOpen.update((isOpen) => !isOpen);
  }

  // Apply the selected block element and close the text style menu
  selectTextStyle(blockName: string): void {
    this.isTextStyleMenuOpen.set(false);

    this.runEditorCommand('formatBlock', blockName);
  }

  // Apply bold formatting to the current or restored selection
  applyBold(): void {
    this.runEditorCommand('bold');
  }

  // Apply italic formatting to the current or restored selection
  applyItalic(): void {
    this.runEditorCommand('italic');
  }

  // Convert the selected block into an unordered list
  applyBulletList(): void {
    this.runEditorCommand('insertUnorderedList');
  }

  // Convert the selected block into an ordered list
  applyNumberedList(): void {
    this.runEditorCommand('insertOrderedList');
  }

  // Convert the selected block into a quotation
  applyQuote(): void {
    this.runEditorCommand('formatBlock', 'blockquote');
  }

  // Ask the hosting form to open the shared picture library. The editor cannot
  // open it itself: the modal belongs to the form, alongside its other pickers.
  requestImage(): void {
    this.focusEditor();
    this.saveSelection();
    this.imagePickerRequested.emit();
  }

  // Whether the next inserted picture carries a border
  toggleImageBorder(): void {
    this.borderNextImage.update((bordered) => !bordered);
  }

  // Insert a picture at the cursor. Called by the form once the library closes.
  insertImage(url: string): void {
    const trimmed = url.trim();
    if (!trimmed) {
      return;
    }

    this.focusEditor();
    const className = this.borderNextImage()
      ? 'blog-body-image is-bordered'
      : 'blog-body-image';

    document.execCommand(
      'insertHTML',
      false,
      `<img src="${this.escapeHtml(trimmed)}" alt="" class="${className}" /><p><br></p>`,
    );

    this.syncContentFromEditor();
    this.saveSelection();
  }

  applyLink(): void {
    // Restore the saved editor selection before inserting or creating a link
    this.focusEditor();
    const href = window.prompt('Link URL', 'https://');

    if (!href) {
      return;
    }

    const selection = window.getSelection();
    const hasSelection =
      selection &&
      !selection.isCollapsed &&
      this.isSelectionInsideEditor(selection);

    if (hasSelection) {
      document.execCommand('createLink', false, href);
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${this.escapeHtml(href)}">${this.escapeHtml(href)}</a>`,
      );
    }

    this.syncContentFromEditor();
    this.saveSelection();
    this.updateActiveFormatting();
  }

  // Convert the selected block into preformatted code
  applyCode(): void {
    this.runEditorCommand('formatBlock', 'pre');
  }

  // Insert a divider followed by an editable paragraph for continued writing
  insertDivider(): void {
    this.runEditorCommand('insertHTML', '<hr><p><br></p>');
  }

  // Delegate formatting undo to the browser editing history
  undoLastFormatting(): void {
    this.runEditorCommand('undo');
  }

  private runEditorCommand(command: string, value?: string): void {
    // Run browser editing command and emit the updated content
    this.focusEditor();
    document.execCommand(command, false, value);
    this.syncContentFromEditor();
    this.saveSelection();
    this.updateActiveFormatting();
  }

  private focusEditor(): void {
    // Focus the editor and restore the last saved selection
    const editor = this.visualEditor()?.nativeElement;

    if (!editor) {
      return;
    }

    editor.focus({ preventScroll: true });
    this.restoreSelection();
  }

  private renderContentToEditor(): void {
    // Render incoming Markdown or HTML into the contenteditable element
    const editor = this.visualEditor()?.nativeElement;

    if (!this.viewReady || !editor) {
      return;
    }

    editor.innerHTML = this.createEditorHtml(this.contentValue);
    this.updateWritingStatistics();
    this.saveSelection();
    this.updateActiveFormatting();
  }

  private syncContentFromEditor(): void {
    // Normalize editor HTML before emitting it to the parent component
    const editor = this.visualEditor()?.nativeElement;

    if (!editor) {
      return;
    }

    const nextContent = this.normalizeEditorHtml(editor.innerHTML);

    if (nextContent === this.contentValue) {
      return;
    }

    this.contentValue = nextContent;
    this.content.set(nextContent);
    this.updateWritingStatistics();
  }

  private createEditorHtml(value: string): string {
    // Keep existing HTML intact, otherwise render Markdown into HTML
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return '';
    }

    if (this.looksLikeHtml(trimmedValue)) {
      return value;
    }

    return marked.parse(value, { async: false }) as string;
  }

  private getPlainText(): string {
    // Prefer the live editor text when available for accurate counts
    const editor = this.visualEditor()?.nativeElement;

    if (editor) {
      return editor.innerText ?? '';
    }

    if (!this.contentValue.trim()) {
      return '';
    }

    const temporaryElement = document.createElement('div');
    temporaryElement.innerHTML = this.createEditorHtml(this.contentValue);
    return temporaryElement.innerText ?? '';
  }

  private normalizeEditorHtml(html: string): string {
    // Treat visually empty editor markup as empty content
    const trimmedHtml = html.trim();
    const temporaryElement = document.createElement('div');
    temporaryElement.innerHTML = trimmedHtml;
    const hasText = Boolean(temporaryElement.textContent?.trim());
    const hasMediaOrDivider = Boolean(
      temporaryElement.querySelector('hr, iframe, img, video'),
    );

    if (!hasText && !hasMediaOrDivider) {
      return '';
    }

    return trimmedHtml;
  }

  private looksLikeHtml(value: string): boolean {
    // Check if stored content already contains HTML tags
    return /<\/?[a-z][\s\S]*>/i.test(value);
  }

  private saveSelection(): void {
    // Save the active selection only when it belongs to this editor
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return;
    }

    if (!this.isSelectionInsideEditor(selection)) {
      return;
    }

    this.savedSelection = selection.getRangeAt(0).cloneRange();
  }

  private restoreSelection(): void {
    // Restore the previously saved selection before toolbar commands run
    if (!this.savedSelection) {
      return;
    }

    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(this.savedSelection);
  }

  private updateActiveFormatting(): void {
    // Inspect the current selection and update toolbar active states
    const selection = window.getSelection();

    if (!selection || !this.isSelectionInsideEditor(selection)) {
      return;
    }

    const activeElement = this.getActiveSelectionElement(selection);
    const blockTag = this.getActiveBlockTag(activeElement);
    const textStyle = ['h1', 'h2', 'h3', 'h4'].includes(blockTag)
      ? blockTag
      : 'p';

    this.activeFormatting.set({
      bold: this.queryCommandState('bold'),
      bulletList: this.queryCommandState('insertUnorderedList'),
      code: blockTag === 'pre' || this.hasAncestor(activeElement, 'pre'),
      italic: this.queryCommandState('italic'),
      link: this.hasAncestor(activeElement, 'a'),
      numberedList: this.queryCommandState('insertOrderedList'),
      quote:
        blockTag === 'blockquote' ||
        this.hasAncestor(activeElement, 'blockquote'),
      textStyle,
    });
  }

  // Recalculate live editor statistics only when the content itself changes
  private updateWritingStatistics(): void {
    const text = this.getPlainText();
    const trimmedText = text.trim();
    this.characterCount.set(text.length);
    this.wordCount.set(trimmedText ? trimmedText.split(/\s+/).length : 0);
  }

  private queryCommandState(command: string): boolean {
    // Some browsers can throw for unsupported editing commands
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }

  private getActiveBlockTag(element: Element | null): string {
    // Find the block-level tag that controls the text style dropdown
    const blockElement = this.getClosestBlockElement(element);

    if (!blockElement) {
      return 'p';
    }

    const tagName = blockElement.tagName.toLowerCase();
    return ['blockquote', 'h1', 'h2', 'h3', 'h4', 'pre'].includes(tagName)
      ? tagName
      : 'p';
  }

  private getActiveSelectionElement(selection: Selection): Element | null {
    // Get the element that contains the current selection
    if (selection.rangeCount === 0) {
      return null;
    }

    const container = selection.getRangeAt(0).commonAncestorContainer;
    return container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement;
  }

  private getClosestBlockElement(element: Element | null): Element | null {
    // Find the nearest supported block element inside the editor
    const editor = this.visualEditor()?.nativeElement;

    if (!editor || !element) {
      return null;
    }

    return element.closest('blockquote, h1, h2, h3, h4, p, pre, li, div');
  }

  private hasAncestor(element: Element | null, selector: string): boolean {
    // Check if the selected element is inside a matching ancestor in this editor
    const editor = this.visualEditor()?.nativeElement;

    if (!editor || !element) {
      return false;
    }

    const ancestor = element.closest(selector);
    return Boolean(ancestor && editor.contains(ancestor));
  }

  private isSelectionInsideEditor(selection: Selection): boolean {
    // Ensure document selections from elsewhere do not affect this editor
    const editor = this.visualEditor()?.nativeElement;

    if (!editor || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer);
  }

  private escapeHtml(value: string): string {
    // Escape user-entered link text before inserting it as HTML
    const temporaryElement = document.createElement('div');
    temporaryElement.innerText = value;
    return temporaryElement.innerHTML;
  }
}
