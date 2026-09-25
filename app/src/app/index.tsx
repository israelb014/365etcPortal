import { Text, View } from 'react-native';
import { colors, type } from '../ui/theme';

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
      <Text style={type.screenTitle}>חידושים</Text>
    </View>
  );
}
