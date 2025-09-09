# RootFinder: Policy Genealogy Tracking for Political Economy Research

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXX)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

## Overview

RootFinder is an open-source computational framework for tracking the genealogy and evolution of public policies across time. Developed to support research on policy persistence and institutional evolution, particularly in the context of Latin American political economy.

This repository contains the complete replication package for:

**"The Extended Phenotype of Populism: A Memetic Analysis of Policy Persistence in Latin America"**  
Ignacio Adrián Lerer (2025)

## Citation

```bibtex
@software{lerer2025rootfinder,
  author = {Lerer, Ignacio Adrián},
  title = {RootFinder: Policy Genealogy Tracking for Political Economy Research},
  year = {2025},
  publisher = {GitHub},
  url = {https://github.com/adrianlerer/RootFinder-Production}
}
```

## Quick Start

```python
from rootfinder import PolicyGenealogy

# Load historical policy database
genealogy = PolicyGenealogy()
genealogy.load_corpus("data/policy-genealogy-argentina.csv")

# Track aguinaldo evolution
aguinaldo_tree = genealogy.trace_lineage("aguinaldo_1945")
print(f"Policy persistence: {aguinaldo_tree.survival_years} years")
print(f"Descendant policies: {len(aguinaldo_tree.descendants)}")
print(f"Inheritance score: {aguinaldo_tree.mean_inheritance:.2f}")
```

## Installation

```bash
# Clone repository
git clone https://github.com/adrianlerer/RootFinder-Production.git
cd RootFinder-Production

# Install dependencies
pip install -r replication/requirements.txt

# Run tests
python -m pytest tests/
```

## Repository Structure

- `/theory`: Theoretical framework and mathematical models
- `/data`: Empirical datasets (elections, policies)
- `/code`: Analysis scripts (R, Python)
- `/rootfinder`: Core RootFinder implementation
- `/replication`: Full replication package
- `/supplementary`: Additional documentation

## Key Features

- **Policy DNA Mapping**: Decompose policies into trackable components
- **Genealogical Tracing**: Identify parent-child policy relationships
- **Mutation Detection**: Track policy evolution over time
- **Persistence Scoring**: Quantify policy survival and inheritance
- **Memetic Fitness Calculation**: Assess policy transmission potential

## Contact

Ignacio Adrián Lerer  
Email: adrian@lerer.com.ar  
ORCID: https://orcid.org/0009-0007-6378-9749

## License

MIT License - See LICENSE file for details