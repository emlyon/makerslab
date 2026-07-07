include(`
    <div class="navbar-fixed">
        <nav class="white" role="navigation">
            <div class="nav-wrapper container">
                <a id="logo-container" href="${appPath('/fr/')}" class="brand-logo"><img src="${appPath('/media/logofactory.svg')}" alt="makers' lab"/></a>
                <a href="#" data-target="nav-mobile" class="sidenav-trigger"><i style="color: #e2001a;" class="material-icons">menu</i></a>
                <ul class="right hide-on-med-and-down">
                    <li><a href="${appPath('/fr/')}">makers' lab</a></li>
                    <li><a href="${appPath('/fr/tutoriels.html')}">tutoriels</a></li>
                    <li><a href="${appPath('/fr/evenements.html')}">événements</a></li>
                    <li><a href="${appPath('/fr/formations.html')}">formations</a></li>
                    <li>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</li>
                    <li class="lang-en"><a href="${appPath('/')}">en</a></li>
                    <li class="lang-fr"><a href="${appPath('/fr/')}">fr</a></li>
                </ul>
            </div>
        </nav>
    </div>
    <ul id="nav-mobile" class="sidenav">
        <li><a href="${appPath('/fr/')}">makers' lab</a></li>
        <li><a href="${appPath('/fr/tutoriels.html')}">tutoriels</a></li>
        <li><a href="${appPath('/fr/evenements.html')}">événements</a></li>
        <li><a href="${appPath('/fr/formations.html')}">formations</a></li>
        <li class="divider"></li>
        <li class="lang-en"><a href="${appPath('/')}">en</a></li>
        <li class="lang-fr"><a href="${appPath('/fr/')}">fr</a></li>
    </ul>
`);
