import {Styles, Colors} from '../helpers';
import {View, Text, TouchableOpacity} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

type Props = {
  headerText: string;
  showBackbutton?: boolean;
  onpress?: () => void;
};

export const MenuHeader = (props: Props) => (
  <View style={Styles.menuHeader}>
    {props.showBackbutton && (
      <TouchableOpacity
        onPress={props.onpress}
        accessibilityLabel="Back"
        style={{paddingRight: 16}}>
        <View
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            backgroundColor: Colors.focusBackground,
          }}>
          <MaterialIcons
            name={'keyboard-arrow-left'}
            color={Colors.textPrimary}
            size={28}
          />
        </View>
      </TouchableOpacity>
    )}

    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      style={{...Styles.H2, flex: 1, color: Colors.textPrimary}}>
      {props.headerText}
    </Text>
  </View>
);
