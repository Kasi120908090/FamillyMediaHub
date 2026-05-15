import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemedAvatar from "../../components/common/ThemedAvatar";
import AppHeader from "../../components/navigation/AppHeader";
import { useProfile } from "../../context/ProfileContext";
import { SCREEN_HORIZONTAL_PADDING } from "../../theme/spacing";

const tabs = ["All", "Uploads", "Comments", "Likes"];

const notifications = [
  {
    id: "1",
    section: "Today",
    type: "Uploads",
    name: "Emma",
    action: "shared 8 new photos",
    subtitle: "Family Beach Trip",
    time: "2 min ago",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
    icon: "image",
    highlight: true,
    thumbnails: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=120",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=120",
      "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=120",
    ],
  },
  {
    id: "2",
    section: "Today",
    type: "Comments",
    name: "Mike",
    action: "commented on your photo",
    subtitle: '"Great shot! Love the lighting"',
    time: "15 min ago",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
    icon: "chatbubble",
    thumbnail: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=120",
    button: "Reply",
  },
  {
    id: "3",
    section: "Today",
    type: "Likes",
    name: "Sarah and 3 others",
    action: "liked your video",
    subtitle: "Birthday Celebration",
    time: "1 hour ago",
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
    icon: "heart",
    thumbnail: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=120",
    reactions: ["heart", "happy"],
  },
  {
    id: "4",
    section: "Yesterday",
    type: "Uploads",
    name: "David",
    action: "created a new album",
    subtitle: "Weekend Hiking Adventure",
    time: "",
    avatar: "https://randomuser.me/api/portraits/men/75.jpg",
    icon: "albums",
    thumbnail: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=120",
    button: "View Album",
  },
  {
    id: "5",
    section: "Yesterday",
    type: "Comments",
    name: "Lisa and Tom",
    action: "commented on your album",
    subtitle: "Morning Coffee Moments",
    time: "18 hours ago",
    avatar: "https://randomuser.me/api/portraits/women/65.jpg",
    icon: "chatbubble",
    commentPreview: '"Love these cozy moments" and 1 other comment',
  },
  {
    id: "6",
    section: "Yesterday",
    type: "All",
    name: "Alex Johnson",
    action: "joined your family group",
    subtitle: "Welcome to the family!",
    time: "22 hours ago",
    avatar: null,
    icon: "person-add",
    button: "Say Hello",
    green: true,
  },
  {
    id: "7",
    section: "This Week",
    type: "Uploads",
    name: "Memory Highlight:",
    action: "One year ago today",
    subtitle: "Emma's First Steps",
    time: "3 days ago",
    avatar: null,
    icon: "sparkles",
    button: "View Memory",
    purple: true,
    thumbnails: [
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=120",
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=120",
    ],
  },
  {
    id: "8",
    section: "This Week",
    type: "Uploads",
    name: "James",
    action: "uploaded 25 photos from Christmas",
    subtitle: "Family Christmas 2024 - 5 days ago",
    time: "",
    avatar: "https://randomuser.me/api/portraits/men/46.jpg",
    icon: "cloud-upload",
    thumbnails: [
      "https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=120",
      "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=120",
      "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=120",
    ],
    more: "+22",
  },
];

export default function NotificationsScreen({ navigation, onOpenMenu }) {
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState("All");

  const listData = useMemo(() => {
    const filtered =
      activeTab === "All"
        ? notifications
        : notifications.filter((item) => item.type === activeTab);

    return filtered.reduce((items, notification, index) => {
      const previous = filtered[index - 1];

      if (!previous || previous.section !== notification.section) {
        items.push({ id: `section-${notification.section}`, sectionTitle: notification.section });
      }

      items.push(notification);
      return items;
    }, []);
  }, [activeTab]);

  const handleNotificationPress = (item) => {
    console.log("Notification pressed:", item.id);
  };

  const handleActionPress = (item) => {
    console.log("Notification action:", item.button, item.id);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Notifications"
        onOpenMenu={onOpenMenu}
        rightContent={
          <TouchableOpacity
            onPress={() => navigation?.navigate("Profile")}
            activeOpacity={0.85}
          >
            <ThemedAvatar uri={profile.image} name={profile.name} style={styles.headerAvatar} />
          </TouchableOpacity>
        }
      />

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) =>
          item.sectionTitle ? (
            <Text style={styles.sectionTitle}>{item.sectionTitle}</Text>
          ) : (
            <NotificationCard
              item={item}
              onPress={handleNotificationPress}
              onActionPress={handleActionPress}
            />
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const NotificationCard = ({ item, onPress, onActionPress }) => {
  const iconStyle = item.green
    ? styles.greenIcon
    : item.purple
      ? styles.purpleIcon
      : styles.avatarIcon;

  return (
    <TouchableOpacity
      style={[styles.notificationCard, item.highlight && styles.highlightCard]}
      onPress={() => onPress(item)}
      activeOpacity={0.88}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.generatedAvatar, iconStyle]}>
          <Ionicons name={item.icon} size={18} color="#FFFFFF" />
        </View>
      )}

      <View style={styles.notificationBody}>
        <View style={styles.titleRow}>
          <Text style={styles.notificationText}>
            <Text style={styles.name}>{item.name} </Text>
            {item.action}
          </Text>
          {item.highlight && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.metaText}>
          {item.subtitle}
          {item.time ? ` - ${item.time}` : ""}
        </Text>

        {item.thumbnail && (
          <View style={styles.mediaRow}>
            <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
            {item.button && (
              <SmallButton title={item.button} item={item} onPress={onActionPress} />
            )}
          </View>
        )}

        {item.thumbnails && (
          <View style={styles.thumbnailRow}>
            {item.thumbnails.map((thumbnail) => (
              <Image key={thumbnail} source={{ uri: thumbnail }} style={styles.smallThumb} />
            ))}
            {item.more && (
              <View style={styles.moreThumb}>
                <Text style={styles.moreText}>{item.more}</Text>
              </View>
            )}
          </View>
        )}

        {item.reactions && (
          <View style={styles.reactionRow}>
            {item.reactions.map((reaction) => (
              <View key={reaction} style={styles.reactionBubble}>
                <Ionicons
                  name={reaction}
                  size={13}
                  color={reaction === "heart" ? "#EF4444" : "#F59E0B"}
                />
              </View>
            ))}
          </View>
        )}

        {item.commentPreview && (
          <View style={styles.commentPreview}>
            <Text style={styles.commentText}>{item.commentPreview}</Text>
          </View>
        )}

        {!item.thumbnail && item.button && (
          <SmallButton title={item.button} item={item} onPress={onActionPress} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const SmallButton = ({ title, item, onPress }) => (
  <TouchableOpacity
    style={[
      styles.smallButton,
      title === "View Memory" && styles.memoryButton,
      title === "Say Hello" && styles.helloButton,
      title === "View Album" && styles.albumButton,
    ]}
    onPress={() => onPress(item)}
    activeOpacity={0.78}
  >
    {title === "Reply" && <Ionicons name="chatbubble" size={10} color="#6B7280" />}
    <Text
      style={[
        styles.smallButtonText,
        title !== "Reply" && styles.coloredButtonText,
      ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },

  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: 12,
  },

  tab: {
    minHeight: 34,
    paddingHorizontal: 18,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F7",
  },

  activeTab: {
    backgroundColor: "#60A5FA",
  },

  tabText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },

  activeTabText: {
    color: "#FFFFFF",
  },

  listContent: {
    paddingBottom: 14,
  },

  sectionTitle: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 7,
  },

  notificationCard: {
    flexDirection: "row",
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  highlightCard: {
    backgroundColor: "#EAF3FF",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },

  generatedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarIcon: {
    backgroundColor: "#38BDF8",
  },

  greenIcon: {
    backgroundColor: "#22C55E",
  },

  purpleIcon: {
    backgroundColor: "#A855F7",
  },

  notificationBody: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  notificationText: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    lineHeight: 18,
  },

  name: {
    fontWeight: "700",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
  },

  metaText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },

  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 9,
  },

  thumbnail: {
    width: 46,
    height: 36,
    borderRadius: 4,
  },

  thumbnailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
  },

  smallThumb: {
    width: 34,
    height: 34,
    borderRadius: 4,
  },

  moreThumb: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },

  moreText: {
    fontSize: 10,
    color: "#374151",
    fontWeight: "600",
  },

  reactionRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  reactionBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },

  commentPreview: {
    marginTop: 9,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },

  commentText: {
    fontSize: 10,
    color: "#6B7280",
  },

  smallButton: {
    minHeight: 26,
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 9,
  },

  albumButton: {
    backgroundColor: "#8B5CF6",
    marginTop: 0,
  },

  memoryButton: {
    backgroundColor: "#D946EF",
  },

  helloButton: {
    backgroundColor: "#22C55E",
  },

  smallButtonText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "700",
  },

  coloredButtonText: {
    color: "#FFFFFF",
  },
});
