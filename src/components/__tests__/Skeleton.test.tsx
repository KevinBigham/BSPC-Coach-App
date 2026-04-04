import React from 'react';
import { render } from '@testing-library/react-native';
import { Skeleton, SkeletonLine, SkeletonCard, SkeletonList } from '../Skeleton';

describe('Skeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Skeleton width={100} height={20} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts custom borderRadius', () => {
    const { toJSON } = render(<Skeleton width={50} height={50} borderRadius={25} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts string width', () => {
    const { toJSON } = render(<Skeleton width="100%" height={14} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonLine', () => {
  it('renders with default width', () => {
    const { toJSON } = render(<SkeletonLine />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom width', () => {
    const { toJSON } = render(<SkeletonLine width="60%" />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonCard', () => {
  it('renders avatar and text lines', () => {
    const { toJSON } = render(<SkeletonCard />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonList', () => {
  it('renders default 5 cards', () => {
    const { toJSON } = render(<SkeletonList />);
    const json = toJSON();
    expect(json).toBeTruthy();
  });

  it('renders custom count', () => {
    const { toJSON } = render(<SkeletonList count={3} />);
    expect(toJSON()).toBeTruthy();
  });
});
