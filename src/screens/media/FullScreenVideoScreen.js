import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import ZoomableMedia from '../../components/media/ZoomableMedia';
import { getMediaUri } from '../../utils/media';
import { useProfile } from '../../context/ProfileContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function FullScreenVideoScreen({ route, navigation }) {
  const { mediaItems = [], initialIndex = 0 } = route.params || {};
  const { canManageMedia, moveMediaToRecycleBin } = useProfile();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [videoSource, setVideoSource] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentItem = mediaItems[currentIndex] || null;
  const remoteUri = currentItem ? getMediaUri(currentItem) : null;

  useEffect(() => {
    if (!currentItem) return;

    const prepareVideo = async () => {
      setIsLoading(true);
      const fileName = currentItem.stored_file_name || currentItem.id.toString();
      const localPath = `${FileSystem.cacheDirectory}${fileName}`;
      
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        setVideoSource(localPath);
      } else {
        setVideoSource(remoteUri);
        FileSystem.downloadAsync(remoteUri, localPath).catch(e => console.log("Cache failed", e));
      }
      setIsLoading(false);
    };
    prepareVideo();
  }, [currentIndex, currentItem]);

  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = false;
    player.play();
  });

  const handleShare = async () => {
    try {
      await Share.share({ url: remoteUri, message: `Check out this video: ${currentItem.original_file_name}` });
    } catch (e) { Alert.alert("Error", "Could not share video"); }
  };

  const handleDelete = () => {
    Alert.alert("Delete Video", "Move this video to recycle bin?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
          moveMediaToRecycleBin(currentItem);
          navigation.goBack();
      }}
    ]);
  };

  if (!currentItem) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#5A23E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.topBar}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.indexText}>{currentIndex + 1} of {mediaItems.length}</Text>
            <Text style={styles.dateText}>{new Date(currentItem.created_at || Date.now()).toLocaleDateString()}</Text>
          </View>
          <View style={styles.rightIconsContainer}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="heart-outline" size={22} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="ellipsis-vertical" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ZoomableMedia 
        style={styles.mediaContainer} 
        onSwipeDown={() => navigation.goBack()}
        controls={false}
      >
        <View style={styles.videoWrapper}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#5A23E5" />
          ) : (
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={true}
            />
          )}
        </View>
      </ZoomableMedia>

      <View style={styles.actionBar}>
        <ActionItem icon="create-outline" label="Edit" onPress={() => {}} />
        <ActionItem icon="share-outline" label="Share" onPress={handleShare} />
        {canManageMedia && (
          <ActionItem icon="trash-outline" label="Delete" onPress={handleDelete} color="#EF4444" />
        )}
      </View>
    </View>
  );
}

const ActionItem = ({ icon, label, onPress, color = "#4B5563" }) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress}>
    <Ionicons name={icon} size={22} color={color} />
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  titleContainer: {
    alignItems: 'center',
  },
  indexText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  dateText: {
    fontSize: 11,
    color: '#6B7280',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 8,
  }
});