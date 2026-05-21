import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export default function BackupSettingsScreen({ navigation, route }) {
  const [photos, setPhotos] = useState(true);
  const [videos, setVideos] = useState(true);
  const [files, setFiles] = useState(true);
  const { userId, profileName } = route.params || {};

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#5B3FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <View style={styles.logoBox}>
              <Ionicons name="home" size={16} color="#fff" />
            </View>

            <Text style={styles.headerTitle}>
              Family Media Hub
            </Text>

            <Ionicons
              name="add"
              size={18}
              color="#5B3FFF"
            />
          </View>

          <View style={styles.headerRight}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#5B3FFF"
            />

            <Image
              source={{
                uri: "https://i.pravatar.cc/100",
              }}
              style={styles.avatar}
            />
          </View>
        </View>

        {/* TITLE */}
        <Text style={styles.pageTitle}>
          Backup Settings
        </Text>

        {/* TOP CARD */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="shield"
                size={18}
                color="#fff"
              />
            </View>

            <View>
              <Text style={styles.cardTitle}>
                Choose what to back up
              </Text>

              <Text style={styles.cardSub}>
                {profileName ? `Settings for ${profileName}` : 'Control backup for each file type separately.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ILLUSTRATION */}
        <View style={styles.imageCard}>
          <Image
            source={{
              uri: "https://cdn-icons-png.flaticon.com/512/1041/1041916.png",
            }}
            style={styles.backupImage}
          />
        </View>

        {/* FILE TYPE */}
        <Text style={styles.sectionTitle}>
          Backup by File Type
        </Text>

        <Text style={styles.sectionSub}>
          Toggle on or off to choose what gets backed up automatically.
        </Text>

        {/* PHOTOS */}
        <View style={styles.mediaCard}>
          <View style={styles.mediaLeft}>
            <View style={styles.mediaIcon}>
              <Ionicons
                name="image"
                size={20}
                color="#5B3FFF"
              />
            </View>

            <View>
              <Text style={styles.mediaTitle}>
                Photos
              </Text>

              <Text style={styles.mediaSub}>
                3,628 items • 8.83 GB
              </Text>
            </View>
          </View>

          <Switch
            value={photos}
            onValueChange={setPhotos}
            trackColor={{
              false: "#ddd",
              true: "#5B3FFF",
            }}
          />
        </View>

        {/* VIDEOS */}
        <View style={styles.mediaCard}>
          <View style={styles.mediaLeft}>
            <View style={styles.mediaIcon}>
              <Ionicons
                name="videocam"
                size={20}
                color="#5B3FFF"
              />
            </View>

            <View>
              <Text style={styles.mediaTitle}>
                Videos
              </Text>

              <Text style={styles.mediaSub}>
                841 items • 114.88 GB
              </Text>
            </View>
          </View>

          <Switch
            value={videos}
            onValueChange={setVideos}
            trackColor={{
              false: "#ddd",
              true: "#5B3FFF",
            }}
          />
        </View>

        {/* FILES */}
        <View style={styles.mediaCard}>
          <View style={styles.mediaLeft}>
            <View style={styles.mediaIcon}>
              <Ionicons
                name="document"
                size={20}
                color="#5B3FFF"
              />
            </View>

            <View>
              <Text style={styles.mediaTitle}>
                Files
              </Text>

              <Text style={styles.mediaSub}>
                1,247 items • 24.65 GB
              </Text>
            </View>
          </View>

          <Switch
            value={files}
            onValueChange={setFiles}
            trackColor={{
              false: "#ddd",
              true: "#5B3FFF",
            }}
          />
        </View>

        {/* BACKUP STATUS */}
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#22C55E"
            />

            <View>
              <Text style={styles.statusTitle}>
                Backup is up to date
              </Text>

              <Text style={styles.statusSub}>
                Last backup: Today, 9:20 AM
              </Text>
            </View>
          </View>

          <TouchableOpacity>
            <Text style={styles.backupNow}>
              Backup now
            </Text>
          </TouchableOpacity>
        </View>

        {/* DESTINATION */}
        <Text style={styles.sectionTitle}>
          Destination
        </Text>

        <View style={styles.destinationCard}>
          <View style={styles.destinationLeft}>
            <Ionicons
              name="folder"
              size={22}
              color="#5B3FFF"
            />

            <View style={{ marginLeft: 10 }}>
              <Text style={styles.mediaTitle}>
                Media
              </Text>

              <Text style={styles.mediaSub}>
                Saved on Personal Drive
              </Text>
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#777"
          />
        </View>

        <Text style={styles.footerText}>
          All selected items are saved in Media on Personal Drive.
        </Text>

      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <NavItem 
          icon="images-outline" 
          label="Gallery" 
          onPress={() => navigation.navigate("Gallery")} 
        />
        <NavItem 
          icon="videocam-outline" 
          label="Videos" 
          onPress={() => navigation.navigate("Videos")} 
        />
        <NavItem 
          icon="document-outline" 
          label="Files" 
          onPress={() => navigation.navigate("Files")} 
        />
        <NavItem
          icon="cloud-upload"
          label="Backup"
          active
        />
      </View>
    </View>
  );
}

const NavItem = ({ icon, label, active, onPress }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <Ionicons
      name={icon}
      size={22}
      color={active ? "#5B3FFF" : "#777"}
    />

    <Text
      style={[
        styles.navLabel,
        active && { color: "#5B3FFF" },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 50,
    paddingBottom: 15,
  },

  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#5B3FFF",
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5B3FFF",
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 18,
  },

  card: {
    marginHorizontal: 18,
    backgroundColor: "#F5F3FF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#5B3FFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  cardSub: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
    width: 220,
  },

  imageCard: {
    marginHorizontal: 18,
    backgroundColor: "#F9F8FF",
    borderRadius: 20,
    alignItems: "center",
    padding: 20,
    marginBottom: 22,
  },

  backupImage: {
    width: 220,
    height: 120,
    resizeMode: "contain",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
  },

  sectionSub: {
    color: "#777",
    fontSize: 12,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 18,
  },

  mediaCard: {
    backgroundColor: "#fff",
    marginHorizontal: 18,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  mediaLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  mediaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  mediaTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  mediaSub: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },

  statusCard: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 20,
    backgroundColor: "#F8FFF9",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  statusTitle: {
    fontWeight: "700",
  },

  statusSub: {
    color: "#777",
    fontSize: 12,
  },

  backupNow: {
    color: "#5B3FFF",
    fontWeight: "700",
  },

  destinationCard: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  destinationLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  footerText: {
    fontSize: 11,
    color: "#777",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 100,
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: "#eee",
  },

  navItem: {
    alignItems: "center",
  },
  navLabel: {
    fontSize: 11,
    color: "#777",
    marginTop: 4,
  },
});