#!/usr/bin/env python3
"""
RootFinder Stress Test - Public Policies Batch Analysis
Politicas publicas AR/UY/CHI - Validacion de supervivencia y herencia

Author: Ignacio Adrian Lerer
Date: September 2025
"""

import sys
import os
import time
import json
import pandas as pd
import numpy as np
from datetime import datetime

# Add RootFinder to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from rootfinder.core import PolicyGenealogy

def run_policies_analysis():
    """Execute public policies genealogy batch analysis"""
    
    print("=== RootFinder Policies Stress Test ===")
    start_time = time.time()
    
    # Initialize genealogy system
    genealogy = PolicyGenealogy()
    
    # Load policies corpus
    corpus_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'corpus_policies_extended.csv')
    
    try:
        genealogy.load_corpus(corpus_path)
        print(f"✅ Loaded policies corpus with {len(genealogy.policies)} nodes")
    except Exception as e:
        print(f"❌ ERROR loading corpus: {e}")
        return None
    
    # Define policy roots for comparative analysis
    policy_roots = {
        "populist_argentina": [
            "ARG_AGUINALDO_1945",
            "ARG_OBRAS_SOCIALES_1970", 
            "ARG_SEVERANCE_1974",
            "ARG_PARITARIAS_1953"
        ],
        "liberal_argentina": [
            "ARG_CONVERTIBILIDAD_1991",
            "ARG_AFJP_1994",
            "ARG_APERTURA_2016"
        ],
        "regional_comparison": [
            "URU_SALARIO_VACACIONAL",
            "URU_AFAP_1996",
            "CHI_AFP_1981"
        ]
    }
    
    # Batch analysis by category
    all_results = {}
    survival_data = []
    
    for category, roots in policy_roots.items():
        print(f"\n🔍 Analyzing {category} policies...")
        category_results = []
        
        for root_id in roots:
            try:
                print(f"  Tracing {root_id}...")
                lineage = genealogy.trace_lineage(root_id)
                
                # Calculate comprehensive metrics
                phenotype_score = genealogy._calculate_phenotype_score(lineage.root_policy)
                memetic_fitness = calculate_memetic_fitness(lineage.root_policy, genealogy)
                
                result = {
                    "policy_id": root_id,
                    "policy_name": lineage.root_policy.name,
                    "category": category,
                    "jurisdiction": extract_jurisdiction(root_id),
                    "ideology": determine_ideology(category, root_id),
                    "year_created": lineage.root_policy.year_created,
                    "year_terminated": getattr(lineage.root_policy, 'year_terminated', None),
                    "survival_years": lineage.root_policy.survival_years,
                    "is_active": lineage.root_policy.is_active,
                    "descendants_count": lineage.total_descendants,
                    "ancestors_count": len(lineage.ancestors),
                    "mean_inheritance": round(lineage.mean_inheritance, 4),
                    "max_inheritance": round(lineage.max_inheritance, 4),
                    "extended_phenotype_score": round(phenotype_score, 4),
                    "memetic_fitness": round(memetic_fitness, 4),
                    "network_degree": calculate_network_degree(genealogy, root_id),
                    "policy_family": extract_policy_family(lineage.root_policy.name)
                }
                
                category_results.append(result)
                
                # Prepare survival analysis data
                survival_entry = {
                    "policy_id": root_id,
                    "time": lineage.root_policy.survival_years,
                    "event": 0 if lineage.root_policy.is_active else 1,
                    "ideology": result["ideology"],
                    "jurisdiction": result["jurisdiction"],
                    "category": category
                }
                survival_data.append(survival_entry)
                
                print(f"    ✓ {result['survival_years']} years, {result['descendants_count']} descendants")
                
            except Exception as e:
                print(f"    ❌ Error analyzing {root_id}: {e}")
                continue
        
        all_results[category] = category_results
    
    # Generate comparative analysis
    print("\n📊 Generating comparative analysis...")
    comparative_stats = generate_comparative_stats(all_results)
    
    # Export results
    results_dir = os.path.join(os.path.dirname(__file__), '..', 'results')
    export_policies_results(all_results, survival_data, comparative_stats, results_dir)
    
    execution_time = time.time() - start_time
    print(f"\n✅ Policies batch analysis completed in {execution_time:.2f} seconds")
    print(f"   Results exported to {results_dir}")
    
    return all_results

def calculate_memetic_fitness(policy, genealogy):
    """Calculate memetic fitness score for a policy"""
    
    # Get policy lineage for fitness calculation
    lineage = genealogy.trace_lineage(policy.id)
    
    # Memetic fitness components (simplified version)
    
    # 1. Transmission success (descendants)
    transmission = min(lineage.total_descendants / 10.0, 1.0)
    
    # 2. Persistence (survival normalized)
    persistence = min(policy.survival_years / 80.0, 1.0)
    
    # 3. Inheritance fidelity
    fidelity = lineage.mean_inheritance if lineage.inheritance_scores else 0.5
    
    # 4. Cultural compatibility (ideology-based proxy)
    if hasattr(policy, 'ideology'):
        if policy.ideology == "Populist":
            cultural_fit = 0.8  # High compatibility in Argentine context
        elif policy.ideology == "Liberal":  
            cultural_fit = 0.3  # Lower compatibility historically
        else:
            cultural_fit = 0.5
    else:
        cultural_fit = 0.5
    
    # 5. Simplicity proxy (inverse of policy complexity)
    # Simplified based on policy type
    if "aguinaldo" in policy.name.lower() or "salario" in policy.name.lower():
        simplicity = 0.9  # Very simple concept
    elif "convertibilidad" in policy.name.lower() or "afjp" in policy.name.lower():
        simplicity = 0.3  # Complex financial mechanisms
    else:
        simplicity = 0.6
    
    # Weighted average
    fitness = (transmission * 0.25 + 
               persistence * 0.25 + 
               fidelity * 0.2 + 
               cultural_fit * 0.2 + 
               simplicity * 0.1)
    
    return fitness

def extract_jurisdiction(policy_id):
    """Extract jurisdiction from policy ID"""
    if policy_id.startswith("ARG"):
        return "Argentina"
    elif policy_id.startswith("URU"):
        return "Uruguay"  
    elif policy_id.startswith("CHI"):
        return "Chile"
    else:
        return "Unknown"

def determine_ideology(category, policy_id):
    """Determine ideological orientation"""
    if "populist" in category.lower():
        return "Populist"
    elif "liberal" in category.lower():
        return "Liberal"
    elif policy_id.startswith("URU"):
        if "afap" in policy_id.lower():
            return "Liberal"
        else:
            return "Social_Democratic"
    elif policy_id.startswith("CHI"):
        return "Liberal"
    else:
        return "Mixed"

def calculate_network_degree(genealogy, node_id):
    """Calculate network degree (total connections)"""
    predecessors = list(genealogy.genealogy_graph.predecessors(node_id))
    successors = list(genealogy.genealogy_graph.successors(node_id))
    return len(predecessors) + len(successors)

def extract_policy_family(policy_name):
    """Extract policy family from name"""
    name_lower = policy_name.lower()
    
    if "aguinaldo" in name_lower or "salario" in name_lower:
        return "Labor_Benefits"
    elif "obras sociales" in name_lower or "salud" in name_lower:
        return "Healthcare"
    elif "indemniz" in name_lower or "severance" in name_lower:
        return "Labor_Protection" 
    elif "paritarias" in name_lower or "convenios" in name_lower:
        return "Collective_Bargaining"
    elif "convertibilidad" in name_lower or "cambiario" in name_lower:
        return "Monetary_Policy"
    elif "afjp" in name_lower or "afp" in name_lower or "afap" in name_lower:
        return "Pension_Systems"
    elif "apertura" in name_lower or "retenciones" in name_lower:
        return "Trade_Policy"
    else:
        return "Other"

def generate_comparative_stats(all_results):
    """Generate comparative statistics across categories and jurisdictions"""
    
    # Flatten all results
    flat_results = []
    for category, results in all_results.items():
        flat_results.extend(results)
    
    df = pd.DataFrame(flat_results)
    
    if df.empty:
        return {}
    
    stats = {
        "overall_summary": {
            "total_policies": len(df),
            "mean_survival": float(df['survival_years'].mean()),
            "median_survival": float(df['survival_years'].median()),
            "active_policies": int(df['is_active'].sum()),
            "terminated_policies": int((~df['is_active']).sum())
        },
        
        "by_ideology": {},
        "by_jurisdiction": {},
        "by_policy_family": {},
        
        "survival_comparison": {
            "populist_vs_liberal": compare_ideologies(df),
            "argentina_vs_regional": compare_jurisdictions(df)
        }
    }
    
    # Statistics by ideology
    for ideology in df['ideology'].unique():
        subset = df[df['ideology'] == ideology]
        stats["by_ideology"][ideology] = {
            "count": len(subset),
            "mean_survival": float(subset['survival_years'].mean()),
            "mean_inheritance": float(subset['mean_inheritance'].mean()),
            "mean_memetic_fitness": float(subset['memetic_fitness'].mean()),
            "active_rate": float(subset['is_active'].mean())
        }
    
    # Statistics by jurisdiction
    for jurisdiction in df['jurisdiction'].unique():
        subset = df[df['jurisdiction'] == jurisdiction]
        stats["by_jurisdiction"][jurisdiction] = {
            "count": len(subset),
            "mean_survival": float(subset['survival_years'].mean()),
            "mean_inheritance": float(subset['mean_inheritance'].mean()),
            "most_persistent": subset.loc[subset['survival_years'].idxmax()]['policy_name'] if len(subset) > 0 else None
        }
    
    # Statistics by policy family
    for family in df['policy_family'].unique():
        subset = df[df['policy_family'] == family]
        stats["by_policy_family"][family] = {
            "count": len(subset),
            "mean_survival": float(subset['survival_years'].mean()),
            "mean_fitness": float(subset['memetic_fitness'].mean())
        }
    
    return stats

def compare_ideologies(df):
    """Compare survival between populist and liberal policies"""
    
    populist = df[df['ideology'] == 'Populist']
    liberal = df[df['ideology'] == 'Liberal']
    
    if len(populist) == 0 or len(liberal) == 0:
        return {"error": "Insufficient data for comparison"}
    
    return {
        "populist_mean_survival": float(populist['survival_years'].mean()),
        "liberal_mean_survival": float(liberal['survival_years'].mean()),
        "survival_ratio": float(populist['survival_years'].mean() / liberal['survival_years'].mean()),
        "populist_active_rate": float(populist['is_active'].mean()),
        "liberal_active_rate": float(liberal['is_active'].mean()),
        "fitness_difference": float(populist['memetic_fitness'].mean() - liberal['memetic_fitness'].mean())
    }

def compare_jurisdictions(df):
    """Compare Argentina vs regional policies"""
    
    argentina = df[df['jurisdiction'] == 'Argentina']
    regional = df[df['jurisdiction'].isin(['Uruguay', 'Chile'])]
    
    if len(argentina) == 0 or len(regional) == 0:
        return {"error": "Insufficient data for comparison"}
    
    return {
        "argentina_mean_survival": float(argentina['survival_years'].mean()),
        "regional_mean_survival": float(regional['survival_years'].mean()),
        "argentina_inheritance": float(argentina['mean_inheritance'].mean()),
        "regional_inheritance": float(regional['mean_inheritance'].mean())
    }

def export_policies_results(all_results, survival_data, comparative_stats, output_dir):
    """Export all policies analysis results"""
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Main results by category
    for category, results in all_results.items():
        if results:
            df = pd.DataFrame(results)
            filename = os.path.join(output_dir, f"policies_{category}_results.csv")
            df.to_csv(filename, index=False)
            print(f"  ✓ Exported {category} results to {filename}")
    
    # Combined results
    all_flat = []
    for results_list in all_results.values():
        all_flat.extend(results_list)
    
    if all_flat:
        df_combined = pd.DataFrame(all_flat)
        combined_file = os.path.join(output_dir, "policies_combined_results.csv")
        df_combined.to_csv(combined_file, index=False)
        print(f"  ✓ Exported combined results to {combined_file}")
    
    # Survival data for R analysis
    if survival_data:
        df_survival = pd.DataFrame(survival_data)
        survival_file = os.path.join(output_dir, "policies_survival_data.csv")
        df_survival.to_csv(survival_file, index=False)
        print(f"  ✓ Exported survival data to {survival_file}")
    
    # Comparative statistics
    stats_file = os.path.join(output_dir, "policies_comparative_stats.json")
    with open(stats_file, 'w') as f:
        json.dump(comparative_stats, f, indent=2)
    print(f"  ✓ Exported comparative stats to {stats_file}")

if __name__ == "__main__":
    results = run_policies_analysis()
    
    if results:
        print("\n🎉 Policies stress test completed successfully!")
        print("   Ready for survival analysis with R script")
    else:
        print("\n💥 Policies stress test failed")