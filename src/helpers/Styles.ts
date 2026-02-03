import {StyleSheet} from 'react-native';
import {DimensionHelper} from './DimensionHelper';
import {StyleConstants} from './StyleConstants';

// Centralized color palette for consistency
export const Colors = {
  // Brand colors
  primary: '#E91E63',
  primaryLight: '#f48fb1',
  primaryDark: '#c2185b',

  // Background colors
  background: '#1a0f17',
  backgroundDark: '#000000',
  backgroundCard: '#2d1f2d',
  surface: '#1a1118',
  surfaceDark: '#120b11',
  navBackground: '#1a0b1a',
  inputBackground: '#100714',

  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#94a3b8',
  textMuted: '#777777',
  textInput: '#e6eef8',

  // State colors
  activeBackground: 'rgba(233,30,99,0.12)',
  hoverBackground: 'rgba(233,30,99,0.08)',
  focusBackground: 'rgba(255,255,255,0.03)',
  pressedBackground: 'rgba(233,30,99,0.8)',

  // Border colors
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(233,30,99,0.15)',

  // Misc
  inactive: '#767577',
};

export const Styles = StyleSheet.create({
  //Splash
  splashMaincontainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  splashImage: {maxWidth: DimensionHelper.wp('70%'), alignSelf: 'center'},

  maincontainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },

  H1: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.hp('4.5%'),
    fontFamily: StyleConstants.RobotoBold,
    letterSpacing: 0.5,
  },
  H2: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.wp('3.5%'),
    fontFamily: StyleConstants.RobotoBold,
    letterSpacing: 0.3,
  },
  H3: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.wp('3%'),
    fontFamily: StyleConstants.RobotoRegular,
    letterSpacing: 0.2,
  },

  messageImage: {maxWidth: DimensionHelper.wp('40%'), alignSelf: 'center'},
  bigWhiteText: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.wp('5%'),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  giantWhiteText: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.wp('15%'),
    textAlign: 'center',
  },
  whiteText: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.wp('3%'),
    textAlign: 'center',
  },
  smallWhiteText: {
    color: Colors.textPrimary,
    fontSize: DimensionHelper.wp('2%'),
    textAlign: 'center',
  },
  smallerWhiteText: {
    color: Colors.textSecondary,
    fontSize: DimensionHelper.wp('1.5%'),
  },

  // Menu / Navigation
  menuScreen: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flex: 1,
    backgroundColor: Colors.background,
    width: '100%',
  },

  menuHeader: {
    height: DimensionHelper.hp('9%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: DimensionHelper.wp('2.5%'),
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderAccent,
  },

  menuFooter: {
    height: DimensionHelper.hp('8%'),
    flexDirection: 'column',
    color: Colors.textPrimary,
    backgroundColor: Colors.surfaceDark,
    padding: 12,
  },
  menuWrapper: {
    flex: 1,
    width: '100%',
    paddingVertical: DimensionHelper.hp('1.5%'),
    paddingHorizontal: DimensionHelper.wp('1%'),
  },
  menuList: {flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start'},

  // menu item used as a row
  menuClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: DimensionHelper.hp('8%'),
    paddingHorizontal: DimensionHelper.wp('3%'),
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },

  smallMenuClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: DimensionHelper.hp('6%'),
    justifyContent: 'flex-start',
    paddingHorizontal: DimensionHelper.wp('3%'),
    borderRadius: 8,
    fontFamily: StyleConstants.RobotoBold,
  },

  // Input styles
  textInputStyle: {
    alignSelf: 'center',
    width: DimensionHelper.wp('86%'),
    maxWidth: 900,
    fontSize: DimensionHelper.wp('2.6%'),
    backgroundColor: Colors.inputBackground,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    color: Colors.textInput,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  textInputStyleFocus: {
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowOpacity: 0.4,
    elevation: 6,
  },

  // Sidebar accents
  navAccent: {backgroundColor: Colors.navBackground},
  navItemActiveBackground: {
    backgroundColor: Colors.activeBackground,
    borderRadius: 8,
  },
  navItemFocusBackground: {
    backgroundColor: Colors.focusBackground,
    borderRadius: 8,
  },

  // Card styles (shared)
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundCard,
  },
  cardFocused: {
    borderWidth: 2,
    borderColor: Colors.primary,
    transform: [{scale: 1.02}],
  },
});
