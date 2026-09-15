import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../features/home/HomeScreen';
import { routes } from './routes';

const Stack = createNativeStackNavigator();

// Auth/role-based route guards are added with the Login & Sign Up work.
export default function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name={routes.Home} component={HomeScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
