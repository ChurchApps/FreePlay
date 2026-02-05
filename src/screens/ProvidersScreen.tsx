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
import { Styles, CachedData, ProviderAuthHelper, Colors } from '../helpers';
import { MenuHeader, SkeletonCard } from '../components';
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
  const [focusedItemId, setFocusedItemId] = React.useState<string | null>(null);
  const initialFocusSet = React.useRef(false);
  const focusedIndexRef = React.useRef<number>(0);
  const screenKey = 'providers';

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
    await ProviderAuthHelper.setConnectionState(providerInfo.id, false);
    CachedData.connectedProviders = CachedData.connectedProviders.filter(id => id !== providerInfo.id);
    if (CachedData.activeProvider === providerInfo.id) {
      CachedData.activeProvider = null;
    }
    setConnectedProviders(prev => prev.filter(id => id !== providerInfo.id));
  };

  const connectAndNavigate = async (providerId: string) => {
    await ProviderAuthHelper.setConnectionState(providerId, true);
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
          { text: 'Disconnect', style: 'destructive', onPress: async () => {
            await handleDisconnect(providerInfo);
          }},
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
      await connectAndNavigate(providerInfo.id);
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
    const savedIndex = CachedData.lastFocusedIndex[screenKey];
    const shouldFocus = !props.sidebarExpanded && !initialFocusSet.current
      && (savedIndex !== undefined ? data.index === savedIndex : data.index === 0);
    const logo = providerInfo.logos?.dark;
    const isFocused = focusedItemId === providerInfo.id;

    return (
      <TouchableHighlight
        style={{
          ...styles.item,
          ...(isFocused ? { transform: [{ scale: 1.03 }] } : {}),
        }}
        underlayColor={Colors.pressedBackground}
        onPress={() => { CachedData.lastFocusedIndex[screenKey] = data.index; handleSelectProvider(providerInfo); }}
        onFocus={() => { initialFocusSet.current = true; focusedIndexRef.current = data.index; setFocusedItemId(providerInfo.id); }}
        onBlur={() => { setFocusedItemId(prev => prev === providerInfo.id ? null : prev); }}
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
              borderWidth: isFocused ? 2 : 1,
              borderColor: isFocused ? Colors.primary : (providerInfo.implemented ? 'rgba(233,30,99,0.15)' : 'rgba(100,100,100,0.15)'),
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
                  color={providerInfo.implemented ? Colors.textSubtle : Colors.textDimmed}
                />
              </View>
            )}
            <Text
              style={{
                color: providerInfo.implemented ? Colors.textPrimary : Colors.textDimmed,
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
                  color={Colors.success}
                />
                <Text
                  style={{
                    color: Colors.success,
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
                  color: Colors.textDimmed,
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
    if (providers.length === 0) {
      const skeletonData = Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}` }));
      return (
        <View style={styles.list}>
          <FlatList
            data={skeletonData}
            numColumns={3}
            keyExtractor={item => item.id}
            renderItem={() => (
              <View style={{ ...styles.item, padding: 7 }}>
                <SkeletonCard width="100%" height={DimensionHelper.hp('28%')} />
              </View>
            )}
          />
        </View>
      );
    }

    const savedIndex = CachedData.lastFocusedIndex[screenKey];
    const initialRow = savedIndex !== undefined ? Math.floor(savedIndex / 3) : undefined;

    return (
      <View style={styles.list}>
        <FlatList
          data={providers}
          numColumns={3}
          renderItem={getProviderCard}
          keyExtractor={item => item.id}
          extraData={[connectedProviders, focusedItemId]}
          initialScrollIndex={initialRow}
          getItemLayout={(_data, idx) => ({
            length: DimensionHelper.hp('35%'),
            offset: DimensionHelper.hp('35%') * idx,
            index: idx,
          })}
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
