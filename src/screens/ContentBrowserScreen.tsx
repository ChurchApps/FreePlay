import React, { useEffect } from 'react';
import {
  Image,
  View,
  FlatList,
  TouchableHighlight,
  ActivityIndicator,
  BackHandler,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SvgUri } from 'react-native-svg';
import { DimensionHelper } from '../helpers/DimensionHelper';
import {
  ContentItem,
  ContentFolder,
  ContentFile,
  isContentFolder,
  isContentFile,
} from '../interfaces';
import { Styles, CachedData, ProviderAuthHelper, Colors } from '../helpers';
import { MenuHeader } from '../components';
import { getProvider } from '../providers';

type Props = {
  navigateTo(page: string, data?: any): void;
  sidebarState: (state: boolean) => void;
  sidebarExpanded?: boolean;
  providerId: string;
  /** Navigation stack of folders (empty = root level) */
  folderStack?: ContentFolder[];
};

export const ContentBrowserScreen = (props: Props) => {
  const [items, setItems] = React.useState<ContentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const initialFocusSet = React.useRef(false);

  const provider = getProvider(props.providerId);
  const folderStack = props.folderStack || [];
  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;

  const styles: any = {
    list: {
      flex: 1,
      marginHorizontal: 'auto',
      width: '100%',
      paddingHorizontal: DimensionHelper.wp('1%'),
    },
    item: {
      flex: 1,
      maxWidth: '33%',
      alignItems: 'center',
      padding: 10,
      borderRadius: 12,
    },
  };

  const loadData = async () => {
    if (!provider) {
      console.error(`Provider ${props.providerId} not found`);
      setLoading(false);
      return;
    }

    setLoading(true);

    const auth = await ProviderAuthHelper.refreshIfNeeded(props.providerId);
    const data = await provider.browse(currentFolder?.path ?? null, auth);

    setItems(data);
    setLoading(false);
    // Allow sidebar to expand via focus now that content is loaded
    CachedData.preventSidebarExpand = false;
  };

  const handleSelectFolder = async (folder: ContentFolder) => {
    if (!provider) return;

    const auth = await ProviderAuthHelper.refreshIfNeeded(props.providerId);

    // Check if this is a leaf folder (end of browse tree)
    if (folder.isLeaf) {
      // Leaf folder - fetch playlist directly instead of browsing
      const files = await provider.getPlaylist(folder.path, auth);

      if (files && files.length > 0) {
        CachedData.messageFiles = files.map(f => ({
          id: f.id,
          name: f.title,
          url: f.url,
          fileType: f.mediaType,
          loopVideo: false,
          seconds: 0,
        }));

        props.navigateTo('providerDownload', {
          providerId: props.providerId,
          coverImage: folder.image,
          title: folder.title,
          startIndex: 0,
          folderStack: [...folderStack, folder],
        });
      } else {
        // No files in playlist - navigate into folder to show empty state
        props.navigateTo('contentBrowser', {
          providerId: props.providerId,
          folderStack: [...folderStack, folder],
        });
      }
      return;
    }

    // Non-leaf folder - fetch contents to check if it has files
    const contents = await provider.browse(folder.path, auth);
    const files = contents.filter((item): item is ContentFile => item.type === 'file');

    if (files.length > 0) {
      // Folder has files - go to download screen
      CachedData.messageFiles = files.map(f => ({
        id: f.id,
        name: f.title,
        url: f.url,
        fileType: f.mediaType,
        loopVideo: false,
        seconds: 0,
      }));

      props.navigateTo('providerDownload', {
        providerId: props.providerId,
        coverImage: folder.image,
        title: folder.title,
        startIndex: 0,
        folderStack: [...folderStack, folder],
      });
    } else {
      // Folder only has subfolders - navigate into it
      props.navigateTo('contentBrowser', {
        providerId: props.providerId,
        folderStack: [...folderStack, folder],
      });
    }
  };

  const handleSelectFile = (file: ContentFile) => {
    // Get all files in current folder for playlist
    const files = items.filter((item): item is ContentFile => item.type === 'file');

    // Convert to playlist format
    CachedData.messageFiles = files.map(f => ({
      id: f.id,
      name: f.title,
      url: f.url,
      fileType: f.mediaType,
      loopVideo: false,
      seconds: 0,
    }));

    // Find selected file index
    const startIndex = files.findIndex(f => f.id === file.id);

    props.navigateTo('providerDownload', {
      providerId: props.providerId,
      coverImage: file.image || currentFolder?.image,
      title: currentFolder?.title || file.title,
      startIndex: startIndex >= 0 ? startIndex : 0,
      folderStack,
    });
  };

  const handleSelect = (item: ContentItem) => {
    if (isContentFolder(item)) {
      handleSelectFolder(item);
    } else if (isContentFile(item)) {
      handleSelectFile(item);
    }
  };

  const getFolderCard = (folder: ContentFolder, index: number) => {
    const shouldFocus = !props.sidebarExpanded && index === 0 && !initialFocusSet.current;
    const folderImage = folder.image || currentFolder?.image || provider?.logos.dark;
    const isFallbackImage = !folder.image;
    const isSvg = folderImage?.toLowerCase().endsWith('.svg');

    return (
      <TouchableHighlight
        style={{ ...styles.item }}
        underlayColor={Colors.pressedBackground}
        onPress={() => handleSelectFolder(folder)}
        onFocus={() => { initialFocusSet.current = true; }}
        hasTVPreferredFocus={shouldFocus}>
        <View style={{ width: '100%' }}>
          {folderImage ? (
            isSvg ? (
              <View style={{
                height: DimensionHelper.hp('28%'),
                width: '100%',
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.surface,
              }}>
                <SvgUri uri={folderImage} width="60%" height="60%" />
              </View>
            ) : isFallbackImage ? (
              <View style={{
                height: DimensionHelper.hp('28%'),
                width: '100%',
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.surface,
              }}>
                <Image
                  style={{
                    height: '80%',
                    width: '80%',
                  }}
                  resizeMode="contain"
                  source={{ uri: folderImage }}
                />
              </View>
            ) : (
              <Image
                style={{
                  height: DimensionHelper.hp('28%'),
                  width: '100%',
                  borderRadius: 12,
                }}
                resizeMode="cover"
                source={{ uri: folderImage }}
              />
            )
          ) : (
            <View
              style={{
                height: DimensionHelper.hp('28%'),
                width: '100%',
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.borderSubtle,
              }}>
              <Icon
                name="folder"
                size={DimensionHelper.wp('8%')}
                color="rgba(255,255,255,0.4)"
              />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: DimensionHelper.wp('1.5%'),
                  textAlign: 'center',
                  paddingHorizontal: 12,
                  marginTop: DimensionHelper.hp('1.5%'),
                }}
                numberOfLines={2}>
                {folder.title}
              </Text>
            </View>
          )}
          {folderImage && (
            <Text
              style={{
                color: '#fff',
                fontSize: DimensionHelper.wp('1.2%'),
                marginTop: DimensionHelper.hp('1%'),
                textAlign: 'center',
              }}
              numberOfLines={2}>
              {folder.title}
            </Text>
          )}
        </View>
      </TouchableHighlight>
    );
  };

  const getFileCard = (file: ContentFile, index: number) => {
    const isVideo = file.mediaType === 'video';
    const shouldFocus = !props.sidebarExpanded && index === 0 && !initialFocusSet.current;

    return (
      <TouchableHighlight
        style={{ ...styles.item }}
        underlayColor={Colors.pressedBackground}
        onPress={() => handleSelectFile(file)}
        onFocus={() => { initialFocusSet.current = true; }}
        hasTVPreferredFocus={shouldFocus}>
        <View style={{ width: '100%' }}>
          <View style={{ position: 'relative' }}>
            {file.image ? (
              <Image
                style={{
                  height: DimensionHelper.hp('20%'),
                  width: '100%',
                  borderRadius: 12,
                }}
                resizeMode="cover"
                source={{ uri: file.image }}
              />
            ) : (
              <View
                style={{
                  height: DimensionHelper.hp('20%'),
                  width: '100%',
                  borderRadius: 12,
                  backgroundColor: Colors.backgroundCard,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Icon
                  name={isVideo ? 'play-circle-outline' : 'image'}
                  size={DimensionHelper.wp('4%')}
                  color="rgba(255,255,255,0.5)"
                />
              </View>
            )}
            {isVideo && file.image && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: 30,
                    padding: 8,
                  }}>
                  <Icon
                    name="play-arrow"
                    size={DimensionHelper.wp('3%')}
                    color="#fff"
                  />
                </View>
              </View>
            )}
          </View>
          <Text
            style={{
              color: '#fff',
              fontSize: DimensionHelper.wp('1.1%'),
              marginTop: DimensionHelper.hp('1%'),
              textAlign: 'center',
            }}
            numberOfLines={2}>
            {file.title}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: DimensionHelper.wp('0.9%'),
              textAlign: 'center',
            }}>
            {isVideo ? 'Video' : 'Image'}
          </Text>
        </View>
      </TouchableHighlight>
    );
  };

  const getCard = (data: { item: ContentItem; index: number }) => {
    const item = data.item;
    if (isContentFolder(item)) {
      return getFolderCard(item, data.index);
    } else {
      return getFileCard(item as ContentFile, data.index);
    }
  };

  const getCards = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text
            style={{
              color: 'rgba(255,255,255,0.6)',
              marginTop: DimensionHelper.hp('2%'),
            }}>
            Loading content...
          </Text>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
            No content available
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.list}>
        <FlatList
          data={items}
          numColumns={3}
          renderItem={getCard}
          keyExtractor={item => item.id}
        />
      </View>
    );
  };

  const handleBack = () => {
    if (folderStack.length > 0) {
      // Go up one level
      const newStack = folderStack.slice(0, -1);
      if (newStack.length === 0) {
        // Return to root
        props.navigateTo('contentBrowser', {
          providerId: props.providerId,
          folderStack: [],
        });
      } else {
        props.navigateTo('contentBrowser', {
          providerId: props.providerId,
          folderStack: newStack,
        });
      }
    } else {
      // At root level, expand sidebar
      props.sidebarState(true);
    }
  };

  const init = () => {
    CachedData.activeProvider = props.providerId;
    initialFocusSet.current = false; // Reset focus tracking for new folder
    // Prevent sidebar from expanding via focus until content loads
    CachedData.preventSidebarExpand = true;
    props.sidebarState(false);
    loadData();
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  };

  useEffect(init, [currentFolder?.id, props.providerId]);

  // Determine header text
  let headerText = provider?.name || 'Browse Content';
  if (currentFolder) {
    headerText = currentFolder.title;
  }

  return (
    <View style={{ ...Styles.menuScreen }}>
      <MenuHeader headerText={headerText} />
      <View style={{ ...Styles.menuWrapper, flex: 90 }}>{getCards()}</View>
    </View>
  );
};
