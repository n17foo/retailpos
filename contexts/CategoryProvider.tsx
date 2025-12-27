import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState } from 'react';

export interface CategoryContextType {
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: Dispatch<SetStateAction<boolean>>;
  selectedCategory: string | null;
  setSelectedCategory: Dispatch<SetStateAction<string | null>>;
  selectedCategoryName: string | null;
  setSelectedCategoryName: Dispatch<SetStateAction<string | null>>;
}

export const CategoryContext = createContext<CategoryContextType | null>(null);

export const CategoryProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  const value = useMemo(() => {
    return {
      isLeftPanelOpen,
      setIsLeftPanelOpen,
      selectedCategory,
      setSelectedCategory,
      selectedCategoryName,
      setSelectedCategoryName,
    };
  }, [isLeftPanelOpen, selectedCategory, selectedCategoryName]);

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
};

export const useCategoryContext = (): CategoryContextType => {
  const categoryContext = useContext(CategoryContext);

  if (categoryContext === null) {
    throw new Error('useCategory must be used within CategoryProvider');
  }

  return categoryContext;
};
