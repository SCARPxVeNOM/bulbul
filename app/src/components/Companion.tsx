import { useState } from "react";
import { Image, Text, View } from "react-native";
import { companionArtUrl } from "@/lib/api";
import type { StageKey } from "@/lib/stages";
import { colors, radius, space, type } from "@/theme";

/**
 * The companion's art for its current stage, served by the bulbul server.
 * If the stage art hasn't been added yet, this says so plainly instead of
 * showing a stand-in image.
 */
export function Companion({ stage, size = 220 }: { stage: StageKey; size?: number }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          padding: space.lg,
          alignSelf: "center",
        }}
        accessibilityLabel={`Companion art for ${stage} has not been added yet`}
      >
        <Text style={[type.small, { textAlign: "center" }]}>Companion art for “{stage}” hasn’t been added yet.</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: companionArtUrl(stage) }}
      style={{ width: size, height: size, alignSelf: "center" }}
      resizeMode="contain"
      onError={() => setMissing(true)}
      accessibilityLabel={`Your companion, ${stage} stage`}
    />
  );
}
