package httpapi_test

import (
	"math"
	"math/rand"
	"sort"
)

func meanFloat(values []int64) float64 {
	var total int64
	for _, value := range values {
		total += value
	}
	return float64(total) / float64(len(values))
}

func stddevFloat(values []int64, mean float64) float64 {
	var sum float64
	for _, value := range values {
		diff := float64(value) - mean
		sum += diff * diff
	}
	return math.Sqrt(sum / float64(len(values)))
}

func bootstrapMeanCI(values []int64, iterations int) (float64, float64) {
	if len(values) == 0 {
		return 0, 0
	}
	rng := rand.New(rand.NewSource(42))
	means := make([]float64, 0, iterations)
	for i := 0; i < iterations; i++ {
		var total int64
		for range values {
			total += values[rng.Intn(len(values))]
		}
		means = append(means, float64(total)/float64(len(values)))
	}
	sort.Float64s(means)
	return means[int(math.Floor(0.025*float64(len(means)-1)))],
		means[int(math.Ceil(0.975*float64(len(means)-1)))]
}
