import React from 'react';
import { render } from '@testing-library/react-native';
import SparkLine from '../SparkLine';

describe('SparkLine', () => {
  it('matches the rendered snapshot', () => {
    const tree = render(<SparkLine data={[4, 6, 5, 7, 3]} width={120} height={40} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders one dot per data point', () => {
    const { getAllByTestId } = render(<SparkLine data={[1, 2, 3, 4]} width={100} height={24} />);
    expect(getAllByTestId(/spark-dot-/)).toHaveLength(4);
  });
});
