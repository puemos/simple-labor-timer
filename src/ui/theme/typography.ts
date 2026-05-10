import { TextStyle } from 'react-native';

export type TypographyVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption1'
  | 'caption2'
  | 'timer';

export type Typography = Record<TypographyVariant, TextStyle>;

export const typography: Typography = {
  largeTitle: {
    fontFamily: undefined,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  title1: {
    fontFamily: undefined,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.36,
  },
  title2: {
    fontFamily: undefined,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  title3: {
    fontFamily: undefined,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: 0.38,
  },
  headline: {
    fontFamily: undefined,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
  body: {
    fontFamily: undefined,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  callout: {
    fontFamily: undefined,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.32,
  },
  subhead: {
    fontFamily: undefined,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
  },
  footnote: {
    fontFamily: undefined,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  caption1: {
    fontFamily: undefined,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
  },
  caption2: {
    fontFamily: undefined,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0.07,
  },
  timer: {
    fontFamily: undefined,
    fontSize: 88,
    lineHeight: 96,
    fontWeight: '200',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
};
