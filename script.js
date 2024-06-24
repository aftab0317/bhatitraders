document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search');
    const dropdown = document.getElementById('dropdown');
    const mobileid = document.getElementById('mobileid');
    const submit = document.getElementById('sub');
    const fsubmit = document.getElementById('finalsub');


  submit.addEventListener("click",()=>{
fsubmit.style.display="block";

  })
  


    searchInput.addEventListener('input', async () => {
        const input = searchInput.value.toLowerCase();
        dropdown.innerHTML = '';

        if (input) {
            const response = await fetch(`/suggest?q=${input}`);
            const suggestions = await response.json();

            if (suggestions.length) {
                dropdown.style.display = 'block';
                suggestions.forEach(suggestion => {
                    const item = document.createElement('div');
                    



                    item.className = 'dropdown-item';
                 


                    item.textContent =`${suggestion.mobilebrand}, ${suggestion.mobilename},  ${suggestion.varient},  ${suggestion.color}`;
             



                    item.addEventListener('click', () => {
                        searchInput.value = `${suggestion.mobilebrand.trim()},  ${suggestion.mobilename},  ${suggestion.varient},  ${suggestion.color}`;
                        dropdown.style.display = 'none';
                        mobileid.value=suggestion.id;
                    });
                    dropdown.appendChild(item);
                   

                });
            } else {
                dropdown.style.display = 'none';
            }
        } else {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.search-container')) {
            dropdown.style.display = 'none';
        }
    });
});
