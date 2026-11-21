import { createContext, useContext } from 'react';

export const Basket = createContext(null);
export const useBasket = () => useContext(Basket);
