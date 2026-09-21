import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';

import MemberTabs from '../navigation/MemberTabs';
import { routes } from '../navigation/routes';

// Renders the real member tab shell with the Library stack (or any tab) open.
export function libraryState(stackRoutes = [{ name: routes.PlansList }]) {
  return {
    index: 0,
    routes: [
      {
        name: routes.LibraryTab,
        state: { index: stackRoutes.length - 1, routes: stackRoutes },
      },
    ],
  };
}

export function planDetailState(planId) {
  return libraryState([{ name: routes.PlansList }, { name: routes.PlanDetail, params: { planId } }]);
}

export async function renderMemberApp({ initialState = libraryState(), onStateChange } = {}) {
  const navigation = { current: null };
  const result = await render(
    <NavigationContainer
      ref={(ref) => {
        navigation.current = ref;
      }}
      initialState={initialState}
      onStateChange={onStateChange}
    >
      <MemberTabs />
    </NavigationContainer>
  );
  return { ...result, navigation };
}

// Route names from the root down to the focused leaf.
export function focusedPath(state) {
  const names = [];
  let current = state;
  while (current) {
    const route = current.routes[current.index ?? 0];
    names.push(route.name);
    current = route.state;
  }
  return names;
}
