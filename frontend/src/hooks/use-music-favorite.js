import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export const useMusicFavorite = (musicId) => {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if music is favorited
  useEffect(() => {
    if (!user?.id || !musicId) {
      setIsFavorite(false);
      setLoading(false);
      return;
    }

    checkFavorite();
  }, [user?.id, musicId]);

  const checkFavorite = async () => {
    try {
      setLoading(true);
      
      // Try new music_favorites table first
      const { data, error } = await supabase
        .from('music_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('music_id', musicId)
        .limit(1);

      if (!error && data && data.length > 0) {
        setIsFavorite(true);
      } else if (error && error.code !== 'PGRST116') {
        // Only log non-permission errors (PGRST116 is "permission denied")
        console.error('Error checking music_favorites:', error.code);
      }
      
      // If no data, try old favorites table
      if (!data || data.length === 0) {
        const { data: oldData, error: oldError } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('song_id', musicId)
          .limit(1);

        if (!oldError && oldData && oldData.length > 0) {
          setIsFavorite(true);
        } else if (oldError && oldError.code !== 'PGRST116') {
          console.error('Error checking favorites:', oldError.code);
        }
      }
    } catch (error) {
      // Silent fail for favorites check - not critical
      console.debug('Favorite check skipped:', error?.message);
      setIsFavorite(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user?.id || !musicId) return;

    try {
      setLoading(true);
      const newFavoriteState = !isFavorite;

      if (isFavorite) {
        // Remove from favorites
        const { error: errorSnake } = await supabase
          .from('music_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('music_id', musicId);

        if (errorSnake) {
          // Try old table with snake_case
          const { error: errorOld } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('song_id', musicId);
          
          if (errorOld) throw errorOld;
        }
      } else {
        // Add to favorites
        const { error: errorSnake } = await supabase
          .from('music_favorites')
          .insert({
            user_id: user.id,
            music_id: musicId,
            created_at: new Date().toISOString()
          });

        if (errorSnake) {
          // Try old table with snake_case
          const { error: errorOld } = await supabase
            .from('favorites')
            .insert({
              user_id: user.id,
              song_id: musicId,
              created_at: new Date().toISOString()
            });
          
          if (errorOld) throw errorOld;
        }
      }

      // Update state after successful operation
      setIsFavorite(newFavoriteState);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { isFavorite, toggleFavorite, loading };
};
