// Owner override O14 (RN-SPEC-time §7.2, gymido d04f7254): Android Back on
// the EXPANDED Rest minimises it to the disc and consumes the press, ahead of
// the leave-workout guard. React Native calls the newest hardwareBackPress
// listener first, and a screen that mounts with a rest already expanded
// registers the rest's listener (a child effect) BEFORE the guard's (the
// parent's), so registration order alone can't put the rest first. Both
// listeners ask this gate first: whichever runs first consumes the press, so
// one Back is one minimise and never the dialog too.
let consumer = null;

// While the Rest is expanded: `onBack` minimises it. Returns the release.
export function setRestBackConsumer(onBack) {
  consumer = onBack;
  return () => {
    if (consumer === onBack) {
      consumer = null;
    }
  };
}

// true when an expanded Rest took the press (it is now minimising).
export function consumeRestBack() {
  if (!consumer) {
    return false;
  }
  consumer();
  return true;
}
