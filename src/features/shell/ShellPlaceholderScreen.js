import PlaceholderScreen from '../placeholders/PlaceholderScreen';

// A tab screen whose own spec hasn't been built yet.
export function makeShellPlaceholder(title) {
  function ShellPlaceholderScreen() {
    return <PlaceholderScreen title={title} />;
  }
  ShellPlaceholderScreen.displayName = `${title.replace(/\s/g, '')}Placeholder`;
  return ShellPlaceholderScreen;
}
