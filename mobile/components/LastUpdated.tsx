import { type useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import ago from 's-ago'
import { Text, View } from 'react-native'

function useNow() {
  const [, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
}

export function LastUpdated({
  query,
}: {
  query: ReturnType<typeof useQuery>
}) {
  useNow()
  return (
    <View className="mt-2 mb-4 items-center">
      <Text className="text-xs text-gray-700">
        {query.isFetching
          ? 'Checking for updates...'
          : `Updated ${ago(new Date(query.dataUpdatedAt))}`}
      </Text>
    </View>
  )
}
