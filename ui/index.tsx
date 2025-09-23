import { render } from 'ink';

// Ink components will be enabled by setting the HUBSPOT_ENABLE_INK environment variable

export async function renderInline(component: React.ReactNode): Promise<void> {
  const { unmount } = render(component, { patchConsole: false });
  unmount();
}
