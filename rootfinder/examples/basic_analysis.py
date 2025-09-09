#!/usr/bin/env python3
"""
RootFinder Basic Analysis Example
Demonstrates core functionality of the PolicyGenealogy system

Author: Ignacio Adrian Lerer
Date: September 2025
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from rootfinder.core import PolicyGenealogy
import pandas as pd

def main():
    """Run basic policy genealogy analysis"""
    
    print("=== RootFinder Basic Analysis Example ===\n")
    
    # Initialize genealogy tracker
    genealogy = PolicyGenealogy()
    
    # Load policy corpus
    data_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'policy-genealogy-argentina.csv')
    
    try:
        genealogy.load_corpus(data_path)
        print(f"✅ Successfully loaded policy corpus\n")
    except Exception as e:
        print(f"❌ Error loading corpus: {e}")
        return
    
    # Example 1: Analyze Aguinaldo policy lineage
    print("=== EXAMPLE 1: Aguinaldo Policy Analysis ===")
    try:
        aguinaldo_lineage = genealogy.trace_lineage("POL001")  # Aguinaldo
        
        print(f"Policy: {aguinaldo_lineage.root_policy.name}")
        print(f"Created: {aguinaldo_lineage.root_policy.year_created}")
        print(f"Survival: {aguinaldo_lineage.root_policy.survival_years} years")
        print(f"Descendants: {aguinaldo_lineage.total_descendants}")
        print(f"Mean Inheritance: {aguinaldo_lineage.mean_inheritance:.3f}")
        
        if aguinaldo_lineage.descendants:
            print("\nDirect descendants:")
            for desc in aguinaldo_lineage.descendants[:3]:  # Show first 3
                inheritance = aguinaldo_lineage.inheritance_scores.get(desc.id, 0)
                print(f"  - {desc.name} ({desc.year_created}) - Inheritance: {inheritance:.3f}")
                
    except Exception as e:
        print(f"❌ Error analyzing Aguinaldo: {e}")
    
    print("\n" + "="*60)
    
    # Example 2: Find extended phenotypes
    print("=== EXAMPLE 2: Extended Phenotypes (Score >= 0.7) ===")
    try:
        extended_phenotypes = genealogy.find_extended_phenotypes(threshold=0.7)
        
        print(f"Found {len(extended_phenotypes)} extended phenotypes:\n")
        
        for policy in extended_phenotypes[:5]:  # Show top 5
            score = genealogy._calculate_phenotype_score(policy)
            print(f"  {policy.name}")
            print(f"    Score: {score:.3f}")
            print(f"    Survival: {policy.survival_years} years")
            print(f"    Ideology: {policy.ideology}")
            print()
            
    except Exception as e:
        print(f"❌ Error finding extended phenotypes: {e}")
    
    print("="*60)
    
    # Example 3: Compare ideologies
    print("=== EXAMPLE 3: Ideological Comparison ===")
    try:
        populist_policies = [p for p in genealogy.policies.values() if p.ideology == "Populist"]
        liberal_policies = [p for p in genealogy.policies.values() if p.ideology == "Liberal"]
        
        pop_survival = [p.survival_years for p in populist_policies]
        lib_survival = [p.survival_years for p in liberal_policies]
        
        print(f"Populist policies: {len(populist_policies)}")
        print(f"  Mean survival: {sum(pop_survival)/len(pop_survival):.1f} years")
        print(f"  Max survival: {max(pop_survival)} years")
        
        print(f"\nLiberal policies: {len(liberal_policies)}")
        print(f"  Mean survival: {sum(lib_survival)/len(lib_survival):.1f} years")
        print(f"  Max survival: {max(lib_survival)} years")
        
        # Find most persistent of each ideology
        most_persistent_pop = max(populist_policies, key=lambda p: p.survival_years)
        most_persistent_lib = max(liberal_policies, key=lambda p: p.survival_years)
        
        print(f"\nMost persistent populist: {most_persistent_pop.name} ({most_persistent_pop.survival_years} years)")
        print(f"Most persistent liberal: {most_persistent_lib.name} ({most_persistent_lib.survival_years} years)")
        
    except Exception as e:
        print(f"❌ Error in ideological comparison: {e}")
    
    print("\n" + "="*60)
    
    # Example 4: Export genealogy data
    print("=== EXAMPLE 4: Data Export ===")
    try:
        # Export Aguinaldo genealogy as JSON
        aguinaldo_json = genealogy.export_genealogy("POL001", format="json")
        
        output_path = os.path.join(os.path.dirname(__file__), '..', '..', 'results')
        os.makedirs(output_path, exist_ok=True)
        
        with open(os.path.join(output_path, 'aguinaldo_genealogy.json'), 'w') as f:
            f.write(aguinaldo_json)
        
        print("✅ Exported Aguinaldo genealogy to results/aguinaldo_genealogy.json")
        
        # Show preview of JSON structure
        import json
        data = json.loads(aguinaldo_json)
        print(f"\nJSON Structure Preview:")
        print(f"  Root policy: {data['root']['name']} ({data['root']['year']})")
        print(f"  Ancestors: {len(data['ancestors'])}")
        print(f"  Descendants: {len(data['descendants'])}")
        print(f"  Total descendants: {data['statistics']['total_descendants']}")
        
    except Exception as e:
        print(f"❌ Error in data export: {e}")
    
    print("\n=== Analysis Complete ===")
    print("To run advanced analysis:")
    print("  cd replication && Rscript survival-analysis.R")
    print("  python code/memetic-fitness-calculator.py")

if __name__ == "__main__":
    main()