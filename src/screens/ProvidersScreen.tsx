import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableHighlight,
  BackHandler,
  Text,
  Alert,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { SvgUri } from 'react-native-svg';
import { DimensionHelper } from '../helpers/DimensionHelper';
import { Styles, CachedData, ProviderAuthHelper } from '../helpers';
import { MenuHeader } from '../components';
import { getProvider, getAvailableProviders } from '../providers';
import { ProviderInfo } from '../interfaces';

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
};

export const ProvidersScreen = (props: Props) => {
  const [connectedProviders, setConnectedProviders] = React.useState<string[]>([]);
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const initialFocusSet = React.useRef(false);

  const styles: any = {
    list: {
      flex: 1,
      marginHorizontal: 'auto',
      width: '100%',
    },
    item: {
      flex: 1,
      maxWidth: '33%',
      alignItems: 'center',
      padding: 7,
      borderRadius: 10,
    },
  };

  const loadProviders = () => {
    const availableProviders = getAvailableProviders();
    setProviders(availableProviders);
  };

  const checkConnections = async () => {
    const connected: string[] = [];
    const availableProviders = getAvailableProviders();
    for (const providerInfo of availableProviders) {
      if (providerInfo.implemented) {
        const isConnected = await ProviderAuthHelper.isConnected(providerInfo.id);
        if (isConnected) {
          connected.push(providerInfo.id);
        }
      }
    }
    setConnectedProviders(connected);
  };

  const handleDisconnect = async (providerInfo: ProviderInfo) => {
    await ProviderAuthHelper.clearAuth(providerInfo.id);
    CachedData.connectedProviders = CachedData.connectedProviders.filter(id => id !== providerInfo.id);
    if (CachedData.activeProvider === providerInfo.id) {
      CachedData.activeProvider = null;
    }
    setConnectedProviders(prev => prev.filter(id => id !== providerInfo.id));
  };

  const connectAndNavigate = (providerId: string) => {
    if (!CachedData.connectedProviders.includes(providerId)) {
      CachedData.connectedProviders.push(providerId);
    }
    CachedData.activeProvider = providerId;
    props.navigateTo('contentBrowser', { providerId, folderStack: [] });
  };

  const handleSelectProvider = async (providerInfo: ProviderInfo) => {
    if (!providerInfo.implemented) {
      Alert.alert('Coming Soon', `${providerInfo.name} is not yet available.`);
      return;
    }

    const isConnected = connectedProviders.includes(providerInfo.id);

    if (isConnected) {
      Alert.alert(
        'Disconnect Provider',
        `Are you sure you want to disconnect from ${providerInfo.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: () => handleDisconnect(providerInfo) },
        ]
      );
      return;
    }

    const provider = getProvider(providerInfo.id);
    if (!provider) {
      Alert.alert('Error', `Provider ${providerInfo.name} not found.`);
      return;
    }

    // Provider-agnostic auth handling based on interface properties
    if (!provider.requiresAuth) {
      connectAndNavigate(providerInfo.id);
    } else if (provider.authTypes.includes('device_flow')) {
      props.navigateTo('providerDeviceAuth', { providerId: providerInfo.id });
    } else if (provider.authTypes.includes('form_login')) {
      props.navigateTo('providerFormLogin', { providerId: providerInfo.id });
    } else {
      Alert.alert('Not Supported', `${providerInfo.name} authentication is not yet supported.`);
    }
  };

  const getProviderCard = (data: { item: ProviderInfo; index: number }) => {
    const providerInfo = data.item;
    const isConnected = connectedProviders.includes(providerInfo.id);
    const shouldFocus = !props.sidebarExpanded && data.index === 0 && !initialFocusSet.current;
    const logo = providerInfo.logos?.dark;

    return (
      <TouchableHighlight
        style={{ ...styles.item }}
        underlayColor={'rgba(233, 30, 99, 0.8)'}
        onPress={() => handleSelectProvider(providerInfo)}
        onFocus={() => { initialFocusSet.current = true; }}
        hasTVPreferredFocus={shouldFocus}>
        <View style={{ width: '100%' }}>
          <LinearGradient
            colors={providerInfo.implemented ? ['#2d1f2d', '#1a1118'] : ['#2a2a2a', '#1a1a1a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              height: DimensionHelper.hp('28%'),
              width: '100%',
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: providerInfo.implemented ? 'rgba(233,30,99,0.15)' : 'rgba(100,100,100,0.15)',
            }}>
            {logo ? (
              <View
                style={{
                  width: '80%',
                  height: DimensionHelper.hp('12%'),
                  marginBottom: DimensionHelper.hp('1%'),
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: providerInfo.implemented ? 1 : 0.5,
                }}>
                {logo.toLowerCase().endsWith('.svg') ? (
                  <SvgUri
                    uri={logo}
                    width="100%"
                    height="100%"
                  />
                ) : (
                  <Image
                    source={{ uri: logo }}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    resizeMode="contain"
                  />
                )}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 40,
                  padding: DimensionHelper.wp('2%'),
                  marginBottom: DimensionHelper.hp('1%'),
                }}>
                <Icon
                  name="extension"
                  size={DimensionHelper.wp('5%')}
                  color={providerInfo.implemented ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'}
                />
              </View>
            )}
            <Text
              style={{
                color: providerInfo.implemented ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: DimensionHelper.wp('1.5%'),
                textAlign: 'center',
                paddingHorizontal: 12,
                textShadowColor: 'rgba(0,0,0,0.3)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
              numberOfLines={2}>
              {providerInfo.name}
            </Text>
            {isConnected && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: DimensionHelper.hp('1%'),
                }}>
                <Icon
                  name="check-circle"
                  size={DimensionHelper.wp('1.2%')}
                  color="#4CAF50"
                />
                <Text
                  style={{
                    color: '#4CAF50',
                    fontSize: DimensionHelper.wp('1%'),
                    marginLeft: 4,
                  }}>
                  Connected
                </Text>
              </View>
            )}
            {!providerInfo.implemented && (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: DimensionHelper.wp('0.9%'),
                  marginTop: DimensionHelper.hp('0.5%'),
                }}>
                Coming Soon
              </Text>
            )}
          </LinearGradient>
        </View>
      </TouchableHighlight>
    );
  };

  const getCards = () => {
    return (
      <View style={styles.list}>
        <FlatList
          data={providers}
          numColumns={3}
          renderItem={getProviderCard}
          keyExtractor={item => item.id}
        />
      </View>
    );
  };

  const handleBack = () => {
    props.sidebarState(true);
    return true;
  };

  const init = () => {
    initialFocusSet.current = false;
    loadProviders();
    checkConnections();
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backHandler.remove();
  };

  useEffect(init, []);

  return (
    <View style={{ ...Styles.menuScreen }}>
      <MenuHeader headerText="Content Providers" />
      <View style={{ ...Styles.menuWrapper, flex: 90 }}>{getCards()}</View>
    </View>
  );
};
