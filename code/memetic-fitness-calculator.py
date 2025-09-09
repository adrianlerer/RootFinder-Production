"""
Memetic Fitness Calculator for Political Messages
Author: Ignacio Adrian Lerer
Date: September 2025
"""

import numpy as np
from dataclasses import dataclass
from typing import Dict, Tuple

@dataclass
class MemeticFactors:
    """Data class for memetic fitness factors"""
    cognitive_simplicity: float  # 0-10
    gratification_speed: float   # 0-10
    emotional_activation: float  # 0-10
    tangibility: float           # 0-10
    entry_cost: float           # 0-10
    
class MemeticFitnessCalculator:
    """Calculate memetic fitness for political messages"""
    
    def __init__(self, country: str = "Argentina"):
        self.country = country
        self.weights = {
            'cognitive_simplicity': 0.25,
            'gratification_speed': 0.25,
            'emotional_activation': 0.20,
            'tangibility': 0.20,
            'entry_cost': 0.10
        }
        
        # Hofstede cultural dimensions for calibration
        self.hofstede = {
            "Argentina": {
                "individualism": 46,
                "power_distance": 49,
                "uncertainty_avoidance": 86,
                "masculinity": 56,
                "long_term_orientation": 20
            }
        }
        
    def calculate_cognitive_simplicity(self, 
                                      flesch_score: float,
                                      propositions: int,
                                      conditionals: int) -> float:
        """Calculate cognitive simplicity score"""
        # Normalize Flesch score (0-100 to 0-10)
        flesch_component = flesch_score / 10
        
        # Penalize multiple propositions
        prop_penalty = max(0, 10 - propositions)
        
        # Penalize conditionals
        cond_penalty = max(0, 10 - conditionals * 2)
        
        return (flesch_component + prop_penalty + cond_penalty) / 3
    
    def calculate_gratification_speed(self, days_to_benefit: float) -> float:
        """Calculate gratification speed score"""
        if days_to_benefit <= 1:
            return 10.0
        elif days_to_benefit <= 7:
            return 8.0
        elif days_to_benefit <= 30:
            return 6.0
        elif days_to_benefit <= 365:
            return 4.0
        elif days_to_benefit <= 1825:  # 5 years
            return 2.0
        else:
            return 1.0
    
    def calculate_emotional_activation(self,
                                      valence: float,
                                      arousal: float,
                                      identity: float) -> float:
        """Calculate emotional activation score"""
        return (valence + arousal + identity) / 3
    
    def calculate_tangibility(self,
                            observable: bool,
                            counterfactual: bool,
                            photogenic: bool) -> float:
        """Calculate tangibility score"""
        score = 0
        if observable:
            score += 4
        if not counterfactual:
            score += 3
        if photogenic:
            score += 3
        return score
    
    def calculate_entry_cost(self,
                            requires_education: bool,
                            requires_effort: bool,
                            requires_sacrifice: bool) -> float:
        """Calculate entry cost score (inverted - lower cost = higher score)"""
        cost = 0
        if requires_education:
            cost += 3
        if requires_effort:
            cost += 3
        if requires_sacrifice:
            cost += 4
        return 10 - cost
    
    def calculate_cultural_compatibility(self, meme_type: str) -> float:
        """Calculate cultural compatibility based on Hofstede dimensions"""
        hofstede = self.hofstede[self.country]
        
        if meme_type == "populist":
            # Populist memes benefit from collectivism, high uncertainty avoidance
            score = (
                (100 - hofstede["individualism"]) / 100 * 0.3 +
                hofstede["uncertainty_avoidance"] / 100 * 0.3 +
                hofstede["power_distance"] / 100 * 0.2 +
                (100 - hofstede["long_term_orientation"]) / 100 * 0.2
            )
        else:  # liberal
            # Liberal memes benefit from individualism, long-term orientation
            score = (
                hofstede["individualism"] / 100 * 0.3 +
                (100 - hofstede["uncertainty_avoidance"]) / 100 * 0.3 +
                (100 - hofstede["power_distance"]) / 100 * 0.2 +
                hofstede["long_term_orientation"] / 100 * 0.2
            )
        
        return score
    
    def calculate_total_fitness(self, 
                               factors: MemeticFactors,
                               meme_type: str,
                               replication_fidelity: float = 0.95) -> Dict:
        """Calculate total memetic fitness"""
        
        # Calculate weighted product
        fitness_components = {
            'cognitive_simplicity': factors.cognitive_simplicity,
            'gratification_speed': factors.gratification_speed,
            'emotional_activation': factors.emotional_activation,
            'tangibility': factors.tangibility,
            'entry_cost': factors.entry_cost
        }
        
        # Weighted geometric mean
        fitness_base = 1.0
        for factor, value in fitness_components.items():
            weight = self.weights[factor]
            fitness_base *= (value ** weight)
        
        # Apply cultural compatibility and replication fidelity
        cultural_compat = self.calculate_cultural_compatibility(meme_type)
        
        total_fitness = fitness_base * replication_fidelity * cultural_compat
        
        return {
            'components': fitness_components,
            'fitness_base': fitness_base,
            'cultural_compatibility': cultural_compat,
            'replication_fidelity': replication_fidelity,
            'total_fitness': total_fitness
        }
    
    def compare_memes(self, 
                     populist_factors: MemeticFactors,
                     liberal_factors: MemeticFactors) -> Dict:
        """Compare fitness between populist and liberal memes"""
        
        populist_fitness = self.calculate_total_fitness(
            populist_factors, "populist", 0.95
        )
        liberal_fitness = self.calculate_total_fitness(
            liberal_factors, "liberal", 0.60
        )
        
        ratio = populist_fitness['total_fitness'] / liberal_fitness['total_fitness']
        
        return {
            'populist': populist_fitness,
            'liberal': liberal_fitness,
            'fitness_ratio': ratio,
            'populist_advantage': ratio > 1
        }

# Example usage
if __name__ == "__main__":
    calculator = MemeticFitnessCalculator("Argentina")
    
    # Argentine populist meme characteristics
    populist = MemeticFactors(
        cognitive_simplicity=8.5,
        gratification_speed=9.0,
        emotional_activation=9.0,
        tangibility=8.0,
        entry_cost=10.0
    )
    
    # Argentine liberal meme characteristics
    liberal = MemeticFactors(
        cognitive_simplicity=2.0,
        gratification_speed=1.5,
        emotional_activation=2.5,
        tangibility=3.0,
        entry_cost=2.0
    )
    
    comparison = calculator.compare_memes(populist, liberal)
    
    print(f"Populist Fitness: {comparison['populist']['total_fitness']:.2f}")
    print(f"Liberal Fitness: {comparison['liberal']['total_fitness']:.2f}")
    print(f"Fitness Ratio: {comparison['fitness_ratio']:.1f}:1")