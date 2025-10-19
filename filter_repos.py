# This script queries the GitHub API to find repositories based on specific criteria

# For the current parameters, the total repo count is 254 from pages 1-3.
# REQUIRED INSTALLS
#!pip install requests
import requests
import csv

# PARAMETERS:
QUERY = "stars:>20000 language:Python size:<300000"
SORT = "stars"
ORDER = "desc"
PER_PAGE = "100" # Max allowed value is 100
page = "1"

# OUTPUT
output_file = "repo_links.csv"

# ADDITIONAL VARIABLES
url = "https://api.github.com/search/repositories"
p = { "q": QUERY, "sort": SORT, "order": ORDER, "per_page": PER_PAGE, "page": page}

# Prepare output .CSV file
with open(output_file, "w", encoding="utf-8") as file:
    #writer = csv.writer(file)
    urls_list = []
    response_status = True
    # Record git links to a list variable
    while response_status:
        response = requests.get(url=url, headers=None, params=p)
        if response.status_code != 200:
            print(f"Error: {response.status_code}, {response.json().get('message')}")
            break
        if response == []:
            print("Empty Page. Ending program")
            break
        data = response.json()
        items = data.get("items", [])
        if not items:
            print("No more results")
            break
        for repo in items:
            urls_list.append(repo["html_url"])
        # End of Loop: Increment Page Number and Update Parameters
        page = str(int(page) + 1)
        p = { "q": QUERY, "sort": SORT, "order": ORDER, "per_page": PER_PAGE, "page": page}
    # Append list file to output .csv file
    for url in urls_list:
        if url != urls_list[0]:
            file.write("\n")
        file.write(url)
        if url != urls_list[-1]:
            file.write(",")

print(urls_list)
print(len(urls_list))