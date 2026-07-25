// Bootstrap is loaded as a global bundle through angular.json rather than imported
// by individual components. Describe only the global API used by the application.
export {};

declare global {
  interface Window {
    bootstrap?: {
      Collapse?: {
        getOrCreateInstance: (
          element: Element,
          config?: { toggle?: boolean },
        ) => { hide: () => void };
      };
    };
  }
}
