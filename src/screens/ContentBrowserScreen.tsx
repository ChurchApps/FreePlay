import React, { useEffect } from "react";
import {
  Image,
  View,
  FlatList,
  TouchableHighlight,
  BackHandler,
  Text
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { SvgUri } from "react-native-svg";
import { DimensionHelper } from "../helpers/DimensionHelper";
import {
  ContentItem,
  ContentFolder,
  ContentFile,
  isContentFolder,
  isContentFile
} from "../interfaces";
import { Styles, CachedData, ProviderAuthHelper, Colors } from "../helpers";
import { MenuHeader, SkeletonCard, EmptyState } from "../components";
import { getProvider } from "../providers";

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
  const [focusedItemId, setFocusedItemId] = React.useState<string | null>(null);
  const initialFocusSet = React.useRef(false);
  const focusedIndexRef = React.useRef<number>(0);
  const listRef = React.useRef<FlatList>(null);
  const requestVersionRef = React.useRef(0);

  const provider = getProvider(props.providerId);
  const folderStack = props.folderStack || [];
  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;

  // Build a unique key for focus memory based on provider + folder path
  const screenKey = `contentBrowser_${props.providerId}_${currentFolder?.id || "root"}`;

  const styles: any = {
    list: {
      flex: 1,
      marginHorizontal: "auto",
      width: "100%",
      paddingHorizontal: DimensionHelper.wp("1%")
    },
    item: {
      flex: 1,
      maxWidth: "33%",
      alignItems: "center",
      padding: 10,
      borderRadius: 12
    }
  };

  const loadData = async () => {
    if (!provider) {
      console.error(`Provider ${props.providerId} not found`);
      setLoading(false);
      return;
    }

    const version = ++requestVersionRef.current;
    setLoading(true);

    const auth = await ProviderAuthHelper.refreshIfNeeded(props.providerId);
    if (version !== requestVersionRef.current) return;

    const data = await provider.browse(currentFolder?.path ?? null, auth);
    if (version !== requestVersionRef.current) return;

    setItems(data);
    setLoading(false);
    // Allow sidebar to expand via focus now that content is loaded
    CachedData.preventSidebarExpand = false;
  };

  const handleSelectFolder = async (folder: ContentFolder) => {
    if (!provider) return;

    const version = ++requestVersionRef.current;

    const auth = await ProviderAuthHelper.refreshIfNeeded(props.providerId);
    if (version !== requestVersionRef.current) return;

    // Check if this is a leaf folder (end of browse tree)
    if (folder.isLeaf) {
      // Leaf folder - fetch playlist directly instead of browsing
      const files = await provider.getPlaylist(folder.path, auth);
      if (version !== requestVersionRef.current) return;

      if (files && files.length > 0) {
        CachedData.messageFiles = files.map(f => ({
          id: f.id,
          name: f.title,
          url: f.url,
          fileType: f.mediaType,
          loop: f.loop,
          loopVideo: f.loopVideo,
          seconds: f.seconds,
          image: f.thumbnail
        }));

        props.navigateTo("providerDownload", {
          providerId: props.providerId,
          coverImage: folder.thumbnail,
          title: folder.title,
          startIndex: 0,
          folderStack: [...folderStack, folder]
        });
      } else {
        // No files in playlist - navigate into folder to show empty state
        props.navigateTo("contentBrowser", {
          providerId: props.providerId,
          folderStack: [...folderStack, folder]
        });
      }
      return;
    }

    // Non-leaf folder - fetch contents to check if it has files
    const contents = await provider.browse(folder.path, auth);
    if (version !== requestVersionRef.current) return;

    const files = contents.filter((item): item is ContentFile => item.type === "file");

    if (files.length > 0) {
      // Folder has files - go to download screen
      CachedData.messageFiles = files.map(f => ({
        id: f.id,
        name: f.title,
        url: f.url,
        fileType: f.mediaType,
        loop: f.loop,
        loopVideo: f.loopVideo,
        seconds: f.seconds,
        image: f.thumbnail
      }));

      props.navigateTo("providerDownload", {
        providerId: props.providerId,
        coverImage: folder.thumbnail,
        title: folder.title,
        startIndex: 0,
        folderStack: [...folderStack, folder]
      });
    } else {
      // Folder only has subfolders - navigate into it
      props.navigateTo("contentBrowser", {
        providerId: props.providerId,
        folderStack: [...folderStack, folder]
      });
    }
  };

  const handleSelectFile = (file: ContentFile) => {
    // Get all files in current folder for playlist
    const files = items.filter((item): item is ContentFile => item.type === "file");

    // Convert to playlist format
    CachedData.messageFiles = files.map(f => ({
      id: f.id,
      name: f.title,
      url: f.url,
      fileType: f.mediaType,
      loop: f.loop,
      loopVideo: f.loopVideo,
      seconds: f.seconds,
      image: f.thumbnail
    }));

    // Find selected file index
    const startIndex = files.findIndex(f => f.id === file.id);

    props.navigateTo("providerDownload", {
      providerId: props.providerId,
      coverImage: file.thumbnail || currentFolder?.thumbnail,
      title: currentFolder?.title || file.title,
      startIndex: startIndex >= 0 ? startIndex : 0,
      folderStack
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
    const savedIndex = CachedData.lastFocusedIndex[screenKey];
    const shouldFocus = !props.sidebarExpanded && !initialFocusSet.current
      && (savedIndex !== undefined ? index === savedIndex : index === 0);
    const folderImage = folder.thumbnail || currentFolder?.thumbnail || provider?.logos.dark;
    const isLogoFallback = !folder.thumbnail && !currentFolder?.thumbnail;
    const isSvg = folderImage?.toLowerCase().endsWith(".svg");
    const isFocused = focusedItemId === folder.id;

    return (
      <TouchableHighlight
        style={{
          ...styles.item,
          ...(isFocused ? {
            borderWidth: 2,
            borderColor: Colors.primary,
            transform: [{ scale: 1.03 }]
          } : { borderWidth: 2, borderColor: "transparent" })
        }}
        underlayColor={Colors.pressedBackground}
        onPress={() => { CachedData.lastFocusedIndex[screenKey] = index; handleSelectFolder(folder); }}
        onFocus={() => { initialFocusSet.current = true; focusedIndexRef.current = index; setFocusedItemId(folder.id); }}
        onBlur={() => { setFocusedItemId(prev => prev === folder.id ? null : prev); }}
        hasTVPreferredFocus={shouldFocus}>
        <View style={{ width: "100%" }}>
          {folderImage ? (
            isSvg ? (
              <View style={{
                height: DimensionHelper.hp("25%"),
                width: "100%",
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: Colors.surface
              }}>
                <SvgUri uri={folderImage} width="60%" height="60%" />
              </View>
            ) : isLogoFallback ? (
              <View style={{
                height: DimensionHelper.hp("25%"),
                width: "100%",
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: Colors.surface
              }}>
                <Image
                  style={{
                    height: "80%",
                    width: "80%"
                  }}
                  resizeMode="contain"
                  source={{ uri: folderImage }}
                />
              </View>
            ) : (
              <Image
                style={{
                  height: DimensionHelper.hp("25%"),
                  width: "100%",
                  borderRadius: 12
                }}
                resizeMode="cover"
                source={{ uri: folderImage }}
              />
            )
          ) : (
            <View
              style={{
                height: DimensionHelper.hp("25%"),
                width: "100%",
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.borderSubtle
              }}>
              <Icon
                name="folder"
                size={DimensionHelper.wp("8%")}
                color="rgba(255,255,255,0.4)"
              />
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: DimensionHelper.wp("1.5%"),
                  textAlign: "center",
                  paddingHorizontal: 12,
                  marginTop: DimensionHelper.hp("1.5%")
                }}
                numberOfLines={2}
                ellipsizeMode="tail">
                {folder.title}
              </Text>
            </View>
          )}
          {folderImage && (
            <Text
              style={{
                color: "#fff",
                fontSize: DimensionHelper.wp("1.2%"),
                marginTop: DimensionHelper.hp("1%"),
                textAlign: "center"
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
    const isVideo = file.mediaType === "video";
    const savedIndex = CachedData.lastFocusedIndex[screenKey];
    const shouldFocus = !props.sidebarExpanded && !initialFocusSet.current
      && (savedIndex !== undefined ? index === savedIndex : index === 0);
    const isFocused = focusedItemId === file.id;

    return (
      <TouchableHighlight
        style={{
          ...styles.item,
          ...(isFocused ? {
            borderWidth: 2,
            borderColor: Colors.primary,
            transform: [{ scale: 1.03 }]
          } : { borderWidth: 2, borderColor: "transparent" })
        }}
        underlayColor={Colors.pressedBackground}
        onPress={() => { CachedData.lastFocusedIndex[screenKey] = index; handleSelectFile(file); }}
        onFocus={() => { initialFocusSet.current = true; focusedIndexRef.current = index; setFocusedItemId(file.id); }}
        onBlur={() => { setFocusedItemId(prev => prev === file.id ? null : prev); }}
        hasTVPreferredFocus={shouldFocus}>
        <View style={{ width: "100%" }}>
          <View style={{ position: "relative" }}>
            {file.thumbnail ? (
              <Image
                style={{
                  height: DimensionHelper.hp("25%"),
                  width: "100%",
                  borderRadius: 12
                }}
                resizeMode="cover"
                source={{ uri: file.thumbnail }}
              />
            ) : (
              <View
                style={{
                  height: DimensionHelper.hp("25%"),
                  width: "100%",
                  borderRadius: 12,
                  backgroundColor: Colors.backgroundCard,
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                <Icon
                  name={isVideo ? "play-circle-outline" : "image"}
                  size={DimensionHelper.wp("4%")}
                  color="rgba(255,255,255,0.5)"
                />
              </View>
            )}
            {isVideo && file.thumbnail && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.5)",
                    borderRadius: 30,
                    padding: 8
                  }}>
                  <Icon
                    name="play-arrow"
                    size={DimensionHelper.wp("3%")}
                    color="#fff"
                  />
                </View>
              </View>
            )}
          </View>
          <Text
            style={{
              color: "#fff",
              fontSize: DimensionHelper.wp("1.1%"),
              marginTop: DimensionHelper.hp("1%"),
              textAlign: "center"
            }}
            numberOfLines={2}
            ellipsizeMode="tail">
            {file.title}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: DimensionHelper.wp("0.9%"),
              textAlign: "center"
            }}>
            {isVideo ? "Video" : "Image"}
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
      const skeletonData = Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}` }));
      return (
        <View style={styles.list}>
          <FlatList
            data={skeletonData}
            numColumns={3}
            keyExtractor={item => item.id}
            renderItem={() => (
              <View style={{ ...styles.item, padding: 10 }}>
                <SkeletonCard width="100%" height={DimensionHelper.hp("25%")} />
              </View>
            )}
          />
        </View>
      );
    }

    if (items.length === 0) {
      return <EmptyState icon="folder-open" message="No content available" subMessage="Try navigating to a different folder" />;
    }

    const savedIndex = CachedData.lastFocusedIndex[screenKey];
    // FlatList initialScrollIndex works on rows, so divide by numColumns
    const initialRow = savedIndex !== undefined ? Math.floor(savedIndex / 3) : undefined;

    return (
      <View style={styles.list}>
        <FlatList
          ref={listRef}
          data={items}
          numColumns={3}
          renderItem={getCard}
          keyExtractor={item => item.id}
          initialScrollIndex={initialRow}
          getItemLayout={(_data, idx) => ({
            length: DimensionHelper.hp("35%"),
            offset: DimensionHelper.hp("35%") * idx,
            index: idx
          })}
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
        props.navigateTo("contentBrowser", {
          providerId: props.providerId,
          folderStack: []
        });
      } else {
        props.navigateTo("contentBrowser", {
          providerId: props.providerId,
          folderStack: newStack
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
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => backHandler.remove();
  };

  useEffect(init, [currentFolder?.id, props.providerId]);

  // Determine header text
  let headerText = provider?.name || "Browse Content";
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
