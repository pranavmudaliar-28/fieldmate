import type { LocationInput } from '@fieldmate/shared';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  toneColors,
  typography,
} from '../../constants/theme';
import { MapPickerModal, MapPreview } from './MapPicker';
import type { PlaceSuggestion } from './provider';
import {
  SEARCH_UNAVAILABLE_MESSAGE,
  getLocationProvider,
  useAddressSearch,
} from './useAddressSearch';

export type LocationValue = {
  address: string;
  addressDetails: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type LocationFieldProps = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  addressError?: string | undefined;
  disabled?: boolean;
};

/**
 * Customer location: search for the place, correct the pin, then add the
 * door-level detail a map cannot know (docs/07 §1). Typing an address by hand
 * always works, because search is a best-effort service and some sites are
 * simply not on the map.
 */
export function LocationField({
  value,
  onChange,
  addressError,
  disabled = false,
}: LocationFieldProps) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(!value.address);
  const [mapOpen, setMapOpen] = useState(false);
  const [reverseFailed, setReverseFailed] = useState(false);
  const { suggestions, searching, unavailable } = useAddressSearch(query, searchOpen && !disabled);

  // Read inside async callbacks, where the rendered `value` would be stale.
  const latest = useRef(value);
  latest.current = value;
  // Only the most recent drag may write an address back.
  const moveId = useRef(0);

  const hasPin = value.latitude !== null && value.longitude !== null;

  const choose = (suggestion: PlaceSuggestion) => {
    onChange({
      ...value,
      address: suggestion.address,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setQuery('');
    setSearchOpen(false);
    setReverseFailed(false);
  };

  /** After the pin moves, refresh the address to match; keep the old one if that fails. */
  const movePin = async (point: { latitude: number; longitude: number }) => {
    const move = ++moveId.current;
    onChange({ ...latest.current, latitude: point.latitude, longitude: point.longitude });
    try {
      const address = await getLocationProvider().reverse(point.latitude, point.longitude);
      // A later drag has already taken over; its answer is the current one.
      if (move !== moveId.current) return;
      if (address) {
        onChange({
          ...latest.current,
          address,
          latitude: point.latitude,
          longitude: point.longitude,
        });
        setReverseFailed(false);
      }
    } catch {
      if (move === moveId.current) setReverseFailed(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.label}>
        Customer location *
      </Text>

      {searchOpen ? (
        <>
          <Input
            label="Search address"
            testID="address-search"
            placeholder="Street, area or landmark"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled}
          />

          {searching ? (
            <View style={styles.searching} testID="address-searching">
              <ActivityIndicator color={colors.primary} />
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
                Searching…
              </Text>
            </View>
          ) : null}

          {unavailable ? (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.warning}
              testID="search-unavailable"
            >
              {SEARCH_UNAVAILABLE_MESSAGE}
            </Text>
          ) : null}

          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              onPress={() => choose(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={suggestion.address}
              testID={`suggestion-${suggestion.id}`}
              style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
            >
              <Text
                maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                style={styles.suggestionPrimary}
              >
                {suggestion.primary}
              </Text>
              {suggestion.secondary ? (
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
                  style={styles.suggestionSecondary}
                  numberOfLines={2}
                >
                  {suggestion.secondary}
                </Text>
              ) : null}
            </Pressable>
          ))}

          {value.address ? (
            <Button
              label="Keep current address"
              variant="ghost"
              size="md"
              testID="close-search"
              onPress={() => setSearchOpen(false)}
            />
          ) : null}
        </>
      ) : (
        <Button
          label="Search for a different address"
          variant="secondary"
          size="md"
          testID="open-search"
          onPress={() => setSearchOpen(true)}
          disabled={disabled}
        />
      )}

      <Input
        label="Address"
        required
        testID="task-address"
        value={value.address}
        onChangeText={(address) => onChange({ ...value, address })}
        {...(addressError ? { error: addressError } : {})}
        multiline
        numberOfLines={2}
        style={styles.addressInput}
        helper={hasPin ? undefined : 'No map pin yet — the worker will see this address as text.'}
        editable={!disabled}
      />

      {hasPin ? (
        <>
          <MapPreview
            latitude={value.latitude as number}
            longitude={value.longitude as number}
            onPress={() => setMapOpen(true)}
            testID="map-picker"
          />
          <MapPickerModal
            visible={mapOpen}
            latitude={value.latitude as number}
            longitude={value.longitude as number}
            onConfirm={(point) => {
              setMapOpen(false);
              void movePin(point);
            }}
            onClose={() => setMapOpen(false)}
            testID="map-picker-modal"
          />
          {reverseFailed ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.warning}>
              The pin moved, but the address could not be refreshed. Edit it above if needed.
            </Text>
          ) : null}
          <View style={styles.pinRow}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
              Pin: {value.latitude}, {value.longitude}
            </Text>
            <Button
              label="Remove pin"
              variant="ghost"
              size="md"
              fullWidth={false}
              testID="remove-pin"
              onPress={() => onChange({ ...value, latitude: null, longitude: null })}
              disabled={disabled}
            />
          </View>
        </>
      ) : null}

      <Input
        label="Flat / floor / gate, landmark"
        testID="task-address-details"
        placeholder="e.g. Flat 3B, second floor, rear gate by the blue shutter"
        value={value.addressDetails ?? ''}
        onChangeText={(text) => onChange({ ...value, addressDetails: text || null })}
        multiline
        numberOfLines={2}
        style={styles.addressInput}
        helper="Anything the worker needs to find the exact door."
        editable={!disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.secondary, color: colors.textPrimary },
  addressInput: { minHeight: 64 },
  searching: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary },
  warning: { ...typography.secondary, color: toneColors.warning.text },
  suggestion: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    gap: 2,
  },
  suggestionPressed: { backgroundColor: colors.surfaceMuted },
  suggestionPrimary: { ...typography.body, color: colors.textPrimary },
  suggestionSecondary: { ...typography.caption, color: colors.textSecondary },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

export type { LocationInput };
