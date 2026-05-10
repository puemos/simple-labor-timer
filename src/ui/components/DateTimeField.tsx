import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import {
  dateTimeInputValueToDate,
  formatCompactDateTime,
  formatEditableDateTime,
} from '@/domain/timing/dateFormat';
import { Body, Footnote } from '@/ui/components/Text';
import { useTheme } from '@/ui/theme';
import { Button } from '@/ui/components/Button';

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function DateTimeField({ label, value, onChangeText }: DateTimeFieldProps) {
  const { colors, radii, scheme, spacing } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => dateTimeInputValueToDate(value));
  const selectedDate = dateTimeInputValueToDate(value);
  const fieldStyle = {
    backgroundColor: colors.tertiarySystemFill,
    borderRadius: radii.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center' as const,
  };

  function commitDate(date?: Date) {
    if (date) {
      onChangeText(formatEditableDateTime(date));
    }
  }

  function handleIosChange(_: DateTimePickerEvent, date?: Date) {
    if (date) {
      setDraftDate(date);
    }
  }

  function openIosPicker() {
    setDraftDate(dateTimeInputValueToDate(value));
    setPickerOpen(true);
  }

  function commitIosPicker() {
    commitDate(draftDate);
    setPickerOpen(false);
  }

  function openAndroidPicker() {
    const current = dateTimeInputValueToDate(value);
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onChange: (dateEvent, pickedDate) => {
        if (dateEvent.type !== 'set' || !pickedDate) {
          return;
        }

        const dateWithCurrentTime = new Date(pickedDate);
        dateWithCurrentTime.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), 0);
        DateTimePickerAndroid.open({
          value: dateWithCurrentTime,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, pickedTime) => {
            const next = new Date(dateWithCurrentTime);
            if (timeEvent.type === 'set' && pickedTime) {
              next.setHours(pickedTime.getHours(), pickedTime.getMinutes(), pickedTime.getSeconds(), 0);
            }
            commitDate(next);
          },
        });
      },
    });
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Footnote color="secondary" style={{ marginBottom: 4 }}>
        {label}
      </Footnote>
      {Platform.OS === 'android' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={openAndroidPicker} style={fieldStyle}>
          <Body>{formatCompactDateTime(selectedDate)}</Body>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens date and time picker"
          onPress={openIosPicker}
          style={fieldStyle}
        >
          <Body>{formatCompactDateTime(selectedDate)}</Body>
        </Pressable>
      )}
      {Platform.OS === 'ios' ? (
        <Modal transparent visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.secondarySystemBackground,
                borderTopLeftRadius: radii.xxl,
                borderTopRightRadius: radii.xxl,
                padding: spacing.base,
                gap: spacing.sm,
              },
            ]}
          >
            <View style={styles.actions}>
              <Button variant="plain" label="Cancel" onPress={() => setPickerOpen(false)} />
              <Button variant="plain" label="Done" onPress={commitIosPicker} />
            </View>
            <DateTimePicker
              value={draftDate}
              mode="datetime"
              display="spinner"
              accentColor={colors.accent}
              textColor={colors.label}
              themeVariant={scheme}
              onChange={handleIosChange}
              style={{ alignSelf: 'stretch', height: 180 }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  sheet: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
