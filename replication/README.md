# Replication Instructions

## Overview

This directory contains all materials necessary to replicate the analyses in "The Extended Phenotype of Populism: A Memetic Analysis of Policy Persistence in Latin America" (Lerer, 2025).

## Requirements

- Python 3.8+
- R 4.0+
- 8GB RAM minimum
- 10GB free disk space

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/adrianlerer/RootFinder-Production.git
cd RootFinder-Production
```

### 2. Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Unix/macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r replication/requirements.txt

# Download spaCy Spanish model
python -m spacy download es_core_news_lg
```

### 3. R Environment

```r
# Install required packages
install.packages(c(
  "survival",
  "survminer", 
  "tidyverse",
  "ggplot2"
))
```

## Replication Steps

### Step 1: Data Preparation

```bash
cd data
python prepare_data.py
```

This creates:
- `policy-genealogy-argentina.csv`: Coded policy database
- `argentina-elections-2025.csv`: Electoral results

### Step 2: Survival Analysis

```bash
cd code
Rscript survival-analysis.R
```

Output:
- `survival_curves.png`: Kaplan-Meier curves
- `hazard_ratios.csv`: Cox model results

### Step 3: Memetic Fitness Calculation

```bash
python memetic-fitness-calculator.py
```

Output:
- Console output showing fitness ratios
- `fitness_comparison.json`: Detailed results

### Step 4: NLP Analysis

```bash
python nlp-discourse-analysis.py
```

Output:
- Complexity scores
- Emotional content analysis
- Linguistic evolution tracking

### Step 5: Genealogy Tracking

```bash
cd ../rootfinder/examples
python aguinaldo_genealogy.py
```

Output:
- `aguinaldo_genealogy.json`: Genealogical data
- `aguinaldo_genealogy.png`: Network visualization

## Validation

Run test suite to verify installation:

```bash
python -m pytest tests/ -v
```

Expected output:
```
tests/test_genealogy.py::test_load_corpus PASSED
tests/test_genealogy.py::test_trace_lineage PASSED
tests/test_fitness.py::test_calculate_fitness PASSED
tests/test_fitness.py::test_compare_memes PASSED
```

## Docker Option

For complete reproducibility, use Docker:

```bash
docker build -t rootfinder .
docker run -it rootfinder
```

## Results

Main findings to replicate:

1. **Survival Ratio**: Populist policies survive 8.8x longer than liberal
2. **Memetic Fitness**: 216:1 advantage for populist memes
3. **Extended Phenotype**: Aguinaldo scores 0.935 (threshold 0.7)
4. **Electoral Validation**: 27.3% vote share (Sept 2025)

## Troubleshooting

Common issues:

1. **Memory Error**: Reduce batch size in NLP analysis
2. **Missing Data**: Ensure all CSV files are in `/data`
3. **Package Conflicts**: Use virtual environment
4. **R Graphics**: Install X11 on Linux servers

## Support

For questions or issues:
- Email: adrian@lerer.com.ar
- GitHub Issues: https://github.com/adrianlerer/RootFinder-Production/issues

## Citation

```bibtex
@article{lerer2025extended,
  author = {Lerer, Ignacio Adrián},
  title = {The Extended Phenotype of Populism: A Memetic Analysis of Policy Persistence in Latin America},
  year = {2025},
  journal = {SSRN Working Paper}
}
```