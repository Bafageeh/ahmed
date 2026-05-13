import React from 'react';
import { TouchableOpacity } from 'react-native';
import Ta3meedCompactFiltersScreen from './Ta3meedCompactFiltersScreen';

const RESET_FILTER_TEXT = 'إعادة الفلتر إلى نشط';

function containsResetFilterText(node) {
  if (typeof node === 'string') return node.includes(RESET_FILTER_TEXT);
  if (Array.isArray(node)) return node.some(containsResetFilterText);
  if (node && typeof node === 'object') return containsResetFilterText(node.props?.children);
  return false;
}

export default function Ta3meedNoResetFilterScreen(props) {
  const originalCreateElement = React.createElement;

  React.createElement = function createElementWithoutResetFilterButton(type, elementProps, ...children) {
    if (type === TouchableOpacity && containsResetFilterText(children)) {
      return null;
    }

    return originalCreateElement.call(this, type, elementProps, ...children);
  };

  try {
    return Ta3meedCompactFiltersScreen(props);
  } finally {
    React.createElement = originalCreateElement;
  }
}
