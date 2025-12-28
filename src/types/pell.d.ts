// Type declaration for pell WYSIWYG editor
declare module 'pell' {
  export interface PellAction {
    name: string;
    icon?: string;
    title?: string;
    state?: () => boolean;
    result?: () => void;
  }

  export interface PellOptions {
    element: HTMLElement;
    onChange: (html: string) => void;
    defaultParagraphSeparator?: string;
    styleWithCSS?: boolean;
    classes?: {
      actionbar?: string;
      button?: string;
      content?: string;
      selected?: string;
    };
    actions?: (string | PellAction)[];
  }

  export interface PellInstance {
    content: HTMLElement;
  }

  export function init(options: PellOptions): PellInstance;
  export function exec(command: string, value?: string): void;
}
